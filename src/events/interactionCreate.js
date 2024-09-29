const { InteractionType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {

        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
                if (!interaction.replied) {
                    await interaction.reply({
                        content: 'There was an error while executing this command!',
                        ephemeral: true
                    });
                }
            }
        }


        if (interaction.isButton()) {

            const member = interaction.guild.members.cache.get(interaction.message.mentions.users.first()?.id);

            if (!member) {

                if (!interaction.replied) {
                    try {
                        await interaction.reply({ content: 'Unable to find the member.', ephemeral: true });
                    } catch (error) {
                        console.error('Error replying to interaction:', error);
                    }
                }
                return;
            }

            try {

                if (interaction.customId === 'verify') {
                    await member.roles.add('VERIFIED_ROLE_ID'); 
                    if (!interaction.replied) {
                        await interaction.reply({ content: `✅ ${member.user.tag} has been verified.`, ephemeral: true });
                    }
                }


                else if (interaction.customId === 'kick') {
                    if (!interaction.member.permissions.has('KICK_MEMBERS')) {
                        if (!interaction.replied) {
                            await interaction.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
                        }
                        return;
                    }

                    await member.kick('Suspected alt account');
                    if (!interaction.replied) {
                        await interaction.reply({ content: `🔨 ${member.user.tag} has been kicked.`, ephemeral: true });
                    }
                }

  
                else if (interaction.customId === 'ban') {
                    if (!interaction.member.permissions.has('BAN_MEMBERS')) {
                        if (!interaction.replied) {
                            await interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
                        }
                        return;
                    }

                    await member.ban({ reason: 'Suspected alt account' });
                    if (!interaction.replied) {
                        await interaction.reply({ content: `🚫 ${member.user.tag} has been banned.`, ephemeral: true });
                    }
                }
            } catch (error) {
                console.error('Error handling interaction:', error);


                if (!interaction.replied) {
                    try {
                        await interaction.reply({ content: 'There was an error processing the action.', ephemeral: true });
                    } catch (replyError) {
                        console.error('Error replying to interaction after failure:', replyError);
                    }
                }
            }
        }
    }
};
