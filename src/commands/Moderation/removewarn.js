const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = './warnings.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removewarn')
        .setDescription('Remove a warning from a user.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to remove a warning from')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('warningnumber')
                .setDescription('The number of the warning to remove')
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
        const warningNumber = interaction.options.getInteger('warningnumber');

        if (warningNumber <= 0) {
            return interaction.reply({ content: 'Warning number must be a positive integer.', ephemeral: true });
        }

        let warnings = {};
        try {
            const data = fs.readFileSync(path, 'utf8');
            warnings = JSON.parse(data);
        } catch (err) {
            console.error('Error reading warnings file:', err);
        }

        if (!warnings[targetUser.id]) {
            return interaction.reply({ content: `${targetUser.tag} has no warnings to remove.`, ephemeral: true });
        }

        const userWarnings = warnings[targetUser.id];
        if (warningNumber > userWarnings.length) {
            return interaction.reply({ content: `Invalid warning number. ${targetUser.tag} has only ${userWarnings.length} warnings.`, ephemeral: true });
        }


        userWarnings.splice(warningNumber - 1, 1);


        if (userWarnings.length === 0) {
            delete warnings[targetUser.id];
        } else {
            warnings[targetUser.id] = userWarnings;
        }


        try {
            fs.writeFileSync(path, JSON.stringify(warnings, null, 2));
        } catch (err) {
            console.error('Error writing warnings file:', err);
            return interaction.reply({ content: 'There was an error saving the updated warnings.', ephemeral: true });
        }

 
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔧 Warning Removed Successfully')
            .setDescription(`**User:** ${targetUser.tag}\n**Warning Number:** ${warningNumber}\n**Action Taken By:** ${interaction.user.tag}`)
            .addFields(
                { name: 'Action Status', value: 'The specified warning has been removed successfully.', inline: false },
                { name: 'Server', value: interaction.guild.name, inline: true },
                { name: 'Timestamp', value: new Date().toLocaleString(), inline: true }
            )
            .setFooter({ text: `Executed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
            .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });


        const logChannel = interaction.guild.channels.cache.get('1280288838715052053'); // Replace with your log channel ID
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#ffcc00')
                .setTitle('⚠️ Warning Removed')
                .setDescription(`**User:** ${targetUser.tag}\n**Warning Number:** ${warningNumber}\n**Removed By:** ${interaction.user.tag}\n**Server:** ${interaction.guild.name}`)
                .addFields(
                    { name: 'Date & Time', value: new Date().toLocaleString(), inline: true },
                    { name: 'Action Type', value: 'Warning Removal', inline: true }
                )
                .setFooter({ text: `Action logged by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 32 }) })
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            logChannel.send({ embeds: [logEmbed] });
        }
    }
};
