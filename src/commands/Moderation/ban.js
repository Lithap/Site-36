const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1280288838715052053'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server with a reason.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(true)),
    async execute(interaction, client) {

        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
        }


        const member = interaction.member;
        if (!member || !member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }


        const targetUser = interaction.options.getUser('target');
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
            return interaction.reply({ content: 'You cannot ban the bot.', ephemeral: true });
        }


        if (member.roles.highest.position <= targetMember.roles.highest.position) {
            return interaction.reply({ content: 'You cannot ban a user with an equal or higher role.', ephemeral: true });
        }


        try {
            await targetMember.ban({ reason: `Banned by ${member.user.tag}: ${reason}` });
        } catch (error) {
            console.error('Error banning the user:', error);
            return interaction.reply({ content: 'Failed to ban the user.', ephemeral: true });
        }


        await interaction.reply({ content: `${targetUser} has been banned from the server. Reason: ${reason}`, ephemeral: true });


        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000') 
                .setTitle('🚫 User Banned 🚫')
                .setDescription(`**Action Taken:** Ban\n` +
                                `**Executed By:** ${member} (${member.user.tag})\n` +
                                `**Target User:** ${targetUser} (${targetUser.tag})\n` +
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
