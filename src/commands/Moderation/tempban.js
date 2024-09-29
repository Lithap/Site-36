const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const ms = require('ms'); 

const LOG_CHANNEL_ID = '1280288838715052053'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempban')
        .setDescription('Temporarily ban a user from the server for a specified duration.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to temporarily ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the ban (e.g., 1h, 30m)')
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
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');


        const banDuration = ms(duration);
        if (!banDuration) {
            return interaction.reply({ content: 'Invalid duration format. Please use formats like `1h`, `30m`, etc.', ephemeral: true });
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
            return interaction.reply({ content: 'You cannot ban the bot.', ephemeral: true });
        }


        if (member.roles.highest.position <= targetMember.roles.highest.position) {
            return interaction.reply({ content: 'You cannot ban a user with an equal or higher role.', ephemeral: true });
        }


        try {
            await targetMember.ban({ reason: `Temporary ban by ${member.user.tag}: ${reason}` });
        } catch (error) {
            console.error('Error banning the user:', error);
            return interaction.reply({ content: 'Failed to ban the user.', ephemeral: true });
        }


        await interaction.reply({ content: `${targetUser} has been temporarily banned from the server for ${duration}. Reason: ${reason}`, ephemeral: true });


        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000') 
                .setTitle('🚫 User Temporarily Banned 🚫')
                .setDescription(`**Action Taken:** Temporary Ban\n` +
                                `**Executed By:** ${member} (${member.user.tag})\n` +
                                `**Target User:** ${targetUser} (${targetUser.tag})\n` +
                                `**Duration:** ${duration}\n` +
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

 
        setTimeout(async () => {
            try {
                await interaction.guild.members.unban(targetUser.id, `Temporary ban lifted after ${duration}`);
                console.log(`${targetUser.tag} has been unbanned after ${duration}`);
            } catch (error) {
                console.error('Error unbanning the user:', error);
            }
        }, banDuration);
    }
};
