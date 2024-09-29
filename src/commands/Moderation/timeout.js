const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1280288838715052053'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user for a specified duration with a reason.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration of the timeout in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1440)) 
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(true)),
    async execute(interaction, client) {

        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
        }


        const member = interaction.member;
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }


        const targetUser = interaction.options.getUser('target');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason');


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
            return interaction.reply({ content: 'You cannot timeout the bot.', ephemeral: true });
        }


        if (member.roles.highest.position <= targetMember.roles.highest.position) {
            return interaction.reply({ content: 'You cannot timeout a user with an equal or higher role.', ephemeral: true });
        }


        const timeoutEnd = Date.now() + (duration * 60 * 1000);


        try {
            await targetMember.timeout(duration * 60 * 1000, `Timeout by ${member.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Error applying timeout:', error);
            return interaction.reply({ content: 'Failed to apply the timeout.', ephemeral: true });
        }

   
        await interaction.reply({ content: `${targetUser} has been timed out for ${duration} minutes. Reason: ${reason}`, ephemeral: true });


        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('#ffcc00') 
                .setTitle('<a:y_timeout:1280304345224708106> User Timed Out <a:y_timeout:1280304345224708106>')
                .setDescription(`**Action Taken:** Timeout\n` +
                                `**Executed By:** ${member} (${member.user.tag})\n` +
                                `**Target User:** ${targetUser} (${targetUser.tag})\n` +
                                `**Duration:** ${duration} minutes\n` +
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
    }
};
