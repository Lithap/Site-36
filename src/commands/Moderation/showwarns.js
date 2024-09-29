const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = './warnings.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showwarns')
        .setDescription('Show all warnings for a user.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to show warnings for')
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
        const targetUserId = targetUser.id;

        let warnings = {};
        try {
            const data = fs.readFileSync(path, 'utf8');
            warnings = JSON.parse(data);
        } catch (err) {
            console.error('Error reading warnings file:', err);
        }

        const targetWarnings = warnings[targetUserId] || [];

        if (targetWarnings.length === 0) {
            return interaction.reply({ content: `${targetUser.tag} has no warnings.`, ephemeral: true });
        }


        const embed = new EmbedBuilder()
            .setColor('#00aaff')
            .setTitle(`📜 Warnings for ${targetUser.tag}`)
            .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
            .setTimestamp();

        targetWarnings.forEach((warning, index) => {
            const issuer = interaction.guild.members.cache.get(warning.issuerId) || { user: { tag: 'Unknown' } };
            embed.addFields({
                name: `Warning #${index + 1}`,
                value: `**Reason:** ${warning.reason}\n**Issued by:** ${issuer.user.tag}\n**Date:** ${new Date(warning.timestamp).toLocaleString()}`,
                inline: false,
            });
        });


        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
