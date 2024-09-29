const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = './warnings.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user for inappropriate behavior.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the warning')
                .setRequired(true)),

    async execute(interaction, client) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
        }

        const member = interaction.member;
        if (!member || !member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');

        if (!reason) {
            return interaction.reply({ content: 'You must provide a reason for the warning.', ephemeral: true });
        }

        let warnings = {};
        try {
            const data = fs.readFileSync(path, 'utf8');
            warnings = JSON.parse(data);
        } catch (err) {
            console.error('Error reading warnings file:', err);
        }

        if (!warnings[targetUser.id]) {
            warnings[targetUser.id] = [];
        }


        const newWarning = {
            reason: reason,
            issuerId: interaction.user.id,
            timestamp: Date.now(),
        };

        warnings[targetUser.id].push(newWarning);

        try {
            fs.writeFileSync(path, JSON.stringify(warnings, null, 2));
        } catch (err) {
            console.error('Error writing warnings file:', err);
            return interaction.reply({ content: 'There was an error saving the warning.', ephemeral: true });
        }


        const userWarnings = warnings[targetUser.id];
        const warningCount = userWarnings.length;
        const logChannel = interaction.guild.channels.cache.get('1280288838715052053'); 

        if (warningCount % 3 === 0) {

            const timeoutDuration = warningCount / 3 * 24 * 60 * 60 * 1000; 
            try {
                const guildMember = await interaction.guild.members.fetch(targetUser.id);
                await guildMember.timeout(timeoutDuration, `Warned ${warningCount} times`);


                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔴 User Timed Out')
                    .setDescription(`**User:** <@${targetUser.id}>\n**Duration:** ${warningCount / 3 * 24} hours\n**Reason:** Repeated warnings`)
                    .addFields(
                        { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Warnings Count', value: `${warningCount}`, inline: true },
                        { name: 'Server', value: interaction.guild.name, inline: true }
                    )
                    .setFooter({ text: `Handled by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                    .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
                    .setTimestamp();

                await interaction.reply({ embeds: [timeoutEmbed], ephemeral: true });


                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔴 User Timed Out')
                        .setDescription(`**User:** <@${targetUser.id}>\n**Issued by:** <@${interaction.user.id}>\n**Reason:** Repeated warnings\n**Duration:** ${warningCount / 3 * 24} hours\n**Warnings Count:** ${warningCount}`)
                        .addFields(
                            { name: 'Server', value: interaction.guild.name, inline: true },
                            { name: 'Date & Time', value: new Date().toLocaleString(), inline: true }
                        )
                        .setFooter({ text: `Action logged by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                        .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
                        .setTimestamp();

                    logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.error('Log channel not found.');
                }


                try {
                    await targetUser.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('🔴 You Have Been Timed Out')
                                .setDescription(`You have been timed out in **${interaction.guild.name}**.`)
                                .addFields(
                                    { name: 'Duration', value: `${warningCount / 3 * 24} hours`, inline: true },
                                    { name: 'Reason', value: 'Repeated warnings', inline: true },
                                    { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true }
                                )
                                .setFooter({ text: `You have ${warningCount} warnings.`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                                .setThumbnail(interaction.guild.iconURL({ format: 'png', size: 128 }))
                                .setTimestamp()
                        ]
                    });
                } catch (error) {
                    console.error('Error sending timeout DM:', error);
                }

            } catch (error) {
                console.error('Error applying timeout:', error);
                await interaction.reply({ content: 'There was an error applying the timeout.', ephemeral: true });
            }
        } else {

            const embed = new EmbedBuilder()
                .setColor('#ffcc00')
                .setTitle('⚠️ User Warned')
                .setDescription(`Successfully warned **${targetUser.tag}**.`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Warnings Count', value: `${warningCount}`, inline: true },
                    { name: 'Server', value: interaction.guild.name, inline: true }
                )
                .setFooter({ text: `Handled by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });


            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#ffcc00')
                    .setTitle('⚠️ User Warned')
                    .setDescription(`**User:** <@${targetUser.id}>\n**Issued by:** <@${interaction.user.id}>\n**Reason:** ${reason}\n**Warnings Count:** ${warningCount}`)
                    .addFields(
                        { name: 'Server', value: interaction.guild.name, inline: true },
                        { name: 'Date & Time', value: new Date().toLocaleString(), inline: true }
                    )
                    .setFooter({ text: `Action logged by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                    .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
                    .setTimestamp();

                logChannel.send({ embeds: [logEmbed] });
            } else {
                console.error('Log channel not found.');
            }


            try {
                await targetUser.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ffcc00')
                            .setTitle('⚠️ You Have Been Warned')
                            .setDescription(`You have been warned in **${interaction.guild.name}**.`)
                            .addFields(
                                { name: 'Reason', value: reason, inline: false },
                                { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Warnings Count', value: `${warningCount}`, inline: true }
                            )
                            .setFooter({ text: `You now have ${warningCount} warnings.`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                            .setThumbnail(interaction.guild.iconURL({ format: 'png', size: 128 }))
                            .setTimestamp()
                    ]
                });
            } catch (error) {
                console.error('Error sending warning DM:', error);
            }
        }
    }
};
