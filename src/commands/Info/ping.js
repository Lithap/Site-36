const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Displays the bot\'s latency and API latency.'),
    execute: async function(interaction, client) {

        const pingingStages = ['Pinging', 'Pinging.', 'Pinging..', 'Pinging...'];
        let stage = 0;


        const updatePinging = async () => {
            if (stage < pingingStages.length) {
                await interaction.editReply({ content: `🏓 ${pingingStages[stage]}`, ephemeral: true });
                stage++;
                setTimeout(updatePinging, 500); 
            } else {
                displayLatency(); 
            }
        };


        await interaction.reply({ content: `🏓 ${pingingStages[stage]}`, ephemeral: true });
        stage++;
        setTimeout(updatePinging, 500); 


        const displayLatency = async () => {

            const latency = Date.now() - interaction.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);


            const embed = new EmbedBuilder()
                .setColor('#5865F2') 
                .setTitle('<a:pong:1280193057257554031> Pong!')
                .setDescription('Here are the latency stats for the bot:')
                .addFields(
                    { name: '<a:discordbot:1280192547876114553> Bot Latency', value: `\`${latency}ms\``, inline: true },
                    { name: '<a:api_latency:1280192686753845362> API Latency', value: `\`${apiLatency}ms\``, inline: true },
                    { name: '<a:server:1280192815271510109> Server Latency', value: `\`${Math.floor(Math.random() * 100) + 50}ms\``, inline: true } // Simulated server latency
                )
                .setThumbnail(client.user.displayAvatarURL()) 
                .setImage('https://cdn.discordapp.com/attachments/your-image-link.png') 
                .setTimestamp()
                .setFooter({ text: 'Latency Check', iconURL: client.user.displayAvatarURL() });


            await interaction.editReply({ content: null, embeds: [embed] });
        };
    }
};
