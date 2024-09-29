const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'quarantine.json');
const LOG_CHANNEL_ID = '1280288838715052053'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quarantine')
        .setDescription('Quarantine a user or remove them from quarantine.')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Quarantine a user by removing their roles and assigning a quarantine role.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to quarantine')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for quarantining the user')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a user from quarantine and restore their roles.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to remove from quarantine')
                        .setRequired(true))),
    execute: async function(interaction, client) {

        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
        }

        const member = interaction.member;
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }


        const targetUser = interaction.options.getUser('target');
        if (!targetUser) {
            return interaction.reply({ content: 'Target user is invalid.', ephemeral: true });
        }


        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            console.error('Error fetching target member:', error);
            return interaction.reply({ content: 'Target user is not in this server or could not be found.', ephemeral: true });
        }


        if (!targetMember) {
            return interaction.reply({ content: 'Target user is not in this server or could not be found.', ephemeral: true });
        }


        if (targetMember.id === client.user.id) {
            return interaction.reply({ content: 'You cannot quarantine the bot.', ephemeral: true });
        }


        if (member.roles.highest.position <= targetMember.roles.highest.position) {
            return interaction.reply({ content: 'You cannot quarantine or unquarantine a user with an equal or higher role.', ephemeral: true });
        }


        const subcommand = interaction.options.getSubcommand();


        let database = {};
        try {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            database = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Error reading the database file:', err);
            }

            console.log('Creating a new quarantine database.');
        }


        await interaction.deferReply({ ephemeral: true });

        try {
            if (subcommand === 'add') {

                const reason = interaction.options.getString('reason');
                if (!reason) {
                    return interaction.editReply({ content: 'You must provide a reason for quarantining the user.', ephemeral: true });
                }


                const roles = targetMember.roles.cache
                    .filter(role => role.id !== interaction.guild.id) 
                    .map(role => ({ id: role.id, name: role.name }));


                if (roles.length === 0) {
                    return interaction.editReply({ content: `${targetUser.tag} does not have any roles to quarantine.`, ephemeral: true });
                }


                database[targetUser.id] = roles;
                try {
                    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
                } catch (error) {
                    console.error('Error writing to the database file:', error);
                    return interaction.editReply({ content: 'Failed to update the quarantine database.', ephemeral: true });
                }


                try {
                    await targetMember.roles.remove(roles.map(role => role.id));
                } catch (error) {
                    console.error('Error removing roles:', error);
                    return interaction.editReply({ content: 'Failed to remove the roles from the user.', ephemeral: true });
                }


                const quarantineRole = interaction.guild.roles.cache.find(role => role.name === 'Quarantine');
                if (!quarantineRole) {
                    return interaction.editReply({ content: 'Quarantine role not found. Please create a role named "Quarantine".', ephemeral: true });
                }
                try {
                    await targetMember.roles.add(quarantineRole);
                } catch (error) {
                    console.error('Error adding quarantine role:', error);
                    return interaction.editReply({ content: 'Failed to add the quarantine role to the user.', ephemeral: true });
                }


                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff4500') 
                        .setTitle('<a:animated_red_excl:1280301601717751878> Bot Latency User Quarantined <a:animated_red_excl:1280301601717751878>')
                        .setDescription(`**Action Taken:** Quarantine\n` +
                                        `**Executed By:** ${member}\n` +
                                        `**Target User:** ${targetUser}\n` +
                                        `**Reason:** ${reason}\n` +
                                        `**Server:** ${interaction.guild.name}\n` +
                                        `**Server ID:** ${interaction.guild.id}`)
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true })) 
                        .setAuthor({
                            name: `${member.user.tag}`,
                            iconURL: member.user.displayAvatarURL({ dynamic: true })
                        })
                        .setTimestamp()
                        .setFooter({ text: `Action by ${member.user.tag}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

                    try {
                        await logChannel.send({ embeds: [embed] });
                    } catch (error) {
                        console.error('Error sending log message:', error);
                    }
                } else {
                    console.error('Log channel not found.');
                }


                await interaction.editReply({ content: `${targetUser} has been quarantined.`, ephemeral: true });

            } else if (subcommand === 'remove') {



                if (!database[targetUser.id]) {
                    return interaction.editReply({ content: `${targetUser} is not currently quarantined.`, ephemeral: true });
                }


                const roles = database[targetUser.id];
                if (!Array.isArray(roles) || roles.length === 0) {
                    return interaction.editReply({ content: 'No roles found to restore for this user.', ephemeral: true });
                }


                try {
                    await targetMember.roles.add(roles.map(role => role.id));
                } catch (error) {
                    console.error('Error restoring roles:', error);
                    return interaction.editReply({ content: 'Failed to restore the original roles.', ephemeral: true });
                }


                await new Promise(resolve => setTimeout(resolve, 2000));


                const quarantineRole = interaction.guild.roles.cache.find(role => role.name === 'Quarantine');
                if (quarantineRole) {
                    try {
                        await targetMember.roles.remove(quarantineRole);
                    } catch (error) {
                        console.error('Error removing quarantine role:', error);
                        return interaction.editReply({ content: 'Failed to remove the quarantine role from the user.', ephemeral: true });
                    }
                }


                delete database[targetUser.id];
                try {
                    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
                } catch (error) {
                    console.error('Error writing to the database file:', error);
                    return interaction.editReply({ content: 'Failed to update the quarantine database.', ephemeral: true });
                }


                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00') 
                        .setTitle('<a:check_yes:1280301947064156210> Quarantine Removed <a:check_yes:1280301947064156210>')
                        .setDescription(`**Action Taken:** Remove Quarantine\n` +
                                        `**Executed By:** ${member}\n` +
                                        `**Target User:** ${targetUser}\n` +
                                        `**Server:** ${interaction.guild.name}\n` +
                                        `**Server ID:** ${interaction.guild.id}`)
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true })) 
                        .setAuthor({
                            name: `${member.user.tag}`,
                            iconURL: member.user.displayAvatarURL({ dynamic: true })
                        })
                        .setTimestamp()
                        .setFooter({ text: `Action by ${member.user.tag}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

                    try {
                        await logChannel.send({ embeds: [embed] });
                    } catch (error) {
                        console.error('Error sending log message:', error);
                    }
                } else {
                    console.error('Log channel not found.');
                }


                await interaction.editReply({ content: `${targetUser} has been removed from quarantine and their roles have been restored.`, ephemeral: true });
            }
        } catch (error) {
            console.error('Error executing command:', error);
            await interaction.editReply({ content: 'There was an error while executing this command.', ephemeral: true });
        }
    }
};
