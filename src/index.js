const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Permissions, MessageManager, Embed, Collection, ButtonBuilder, ButtonStyle, ActionRowBuilder} = require(`discord.js`);
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');
const levenshtein = require('fast-levenshtein');
const config = require('./config.json');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,                   // Server-based events
        GatewayIntentBits.GuildMembers,             // Member updates, joins
        GatewayIntentBits.GuildBans,                // Ban events
        GatewayIntentBits.GuildEmojisAndStickers,   // Emoji updates
        GatewayIntentBits.GuildIntegrations,        // Integration events
        GatewayIntentBits.GuildWebhooks,            // Webhook updates
        GatewayIntentBits.GuildInvites,             // Invite create and delete events
        GatewayIntentBits.GuildVoiceStates,         // Voice channel state
        GatewayIntentBits.GuildPresences,           // Presence updates
        GatewayIntentBits.GuildMessages,            // Message create/update/delete
        GatewayIntentBits.GuildMessageReactions,    // Message reactions
        GatewayIntentBits.GuildMessageTyping,       // Typing events
        GatewayIntentBits.DirectMessages,           // DM events
        GatewayIntentBits.DirectMessageReactions,   // DM reactions
        GatewayIntentBits.DirectMessageTyping,      // DM typing
        GatewayIntentBits.MessageContent            // Content of messages (for bots with permission)
    ]
});


client.commands = new Collection();

require('dotenv').config();

const functions = fs.readdirSync("./src/functions").filter(file => file.endsWith(".js"));
const eventFiles = fs.readdirSync("./src/events").filter(file => file.endsWith(".js"));
const commandFolders = fs.readdirSync("./src/commands");

(async () => {
    for (file of functions) {
        require(`./functions/${file}`)(client);
    }
    client.handleEvents(eventFiles, "./src/events");
    client.handleCommands(commandFolders, "./src/commands");
    client.login(process.env.token)
})();


//----------------------------------------------------ANTI SPAM---------------------------------------------------//
const userMessageTimestamps = new Map();

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; 

    const now = Date.now();
    const userId = message.author.id;
    

    if (message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
 
    }

    if (!userMessageTimestamps.has(userId)) {
        userMessageTimestamps.set(userId, []);
    }

    const timestamps = userMessageTimestamps.get(userId);
    

    while (timestamps.length && now - timestamps[0] > config.spam.timeWindow) {
        timestamps.shift();
    }
    
    timestamps.push(now);
    

    if (timestamps.length > config.spam.messageLimit) {

        const guildMember = await message.guild.members.fetch(userId);
        if (guildMember) {
            try {
                await guildMember.timeout(config.spam.timeoutDuration, 'Spam detected');
                console.log(`Timed out ${guildMember.user.tag} for ${config.spam.timeoutDuration / 1000} seconds due to spam.`);


                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔴 **You Have Been Timed Out**')
                    .setDescription(`You have been temporarily timed out in **${message.guild.name}** due to spamming.`)
                    .addFields(
                        { name: '⏰ Duration', value: `${config.spam.timeoutDuration / 1000} seconds`, inline: true },
                        { name: '⚠️ Reason', value: 'Sending too many messages in a short period.', inline: true },
                        { name: '📅 Date & Time', value: new Date().toLocaleString(), inline: true }
                    )
                    .setFooter({ text: `Action taken by ${client.user.username}`, iconURL: client.user.displayAvatarURL({ format: 'png', size: 32 }) })
                    .setThumbnail(message.guild.iconURL({ format: 'png', size: 128 }))
                    .setTimestamp();

                await message.author.send({ embeds: [timeoutEmbed] });


                const logChannel = await message.guild.channels.fetch('1280343199793287241'); 
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔴 **User Timed Out**')
                        .setDescription(`**User:** <@${userId}>\n**Duration:** ${config.spam.timeoutDuration / 1000} seconds\n**Reason:** Sending too many messages in a short period.\n**Date & Time:** ${new Date().toLocaleString()}`)
                        .addFields(
                            { name: '⚠️ Action Taken By', value: `<@${client.user.id}>`, inline: true },
                            { name: 'Server', value: message.guild.name, inline: true }
                        )
                        .setFooter({ text: `Logged by ${client.user.username}`, iconURL: client.user.displayAvatarURL({ format: 'png', size: 32 }) })
                        .setThumbnail(message.guild.iconURL({ format: 'png', size: 128 }))
                        .setTimestamp();

                    logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.error('Log channel not found.');
                }
            } catch (error) {
                console.error(`Failed to timeout ${guildMember.user.tag}:`, error);
                await message.author.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🔴 **Error**')
                            .setDescription('There was an error applying the timeout. Please contact a server administrator if this issue persists.')
                            .setFooter({ text: `Action taken by ${client.user.username}`, iconURL: client.user.displayAvatarURL({ format: 'png', size: 32 }) })
                            .setTimestamp()
                    ]
                });
            }
        }

        userMessageTimestamps.delete(userId);
    } else {

        userMessageTimestamps.set(userId, timestamps);
    }
});
//----------------------------------------------------Banned Words System---------------------------------------------------//

const bannedWords = [
    'nigga',
    'nigger',
    'nazi'
];


const fuse = new Fuse(bannedWords.map(word => ({ word })), { 
    includeScore: true, 
    threshold: 0.3, 
    keys: ['word']
});


function normalizeRepeatedChars(text) {
    return text.replace(/(.)\1{2,}/g, '$1$1');
}


function containsBannedWord(messageContent) {
    const normalizedContent = normalizeRepeatedChars(messageContent);
    const results = fuse.search(normalizedContent);

    return results.some(result => {
        const bannedWord = result.item.word;
        const score = result.score;
        const editDistance = levenshtein.get(normalizedContent, bannedWord);
        return score < 0.3 && editDistance <= 2;
    });
}


const flaggedMessagesFilePath = path.join(__dirname, 'flaggedMessages.json');


const warningsFilePath = path.join(__dirname, '..', 'warnings.json');

let flaggedMessages = new Map(); 


function loadFlaggedMessages() {
    try {
        if (fs.existsSync(flaggedMessagesFilePath)) {
            const data = fs.readFileSync(flaggedMessagesFilePath);
            flaggedMessages = new Map(Object.entries(JSON.parse(data)));
        }
    } catch (error) {
        console.error('Error loading flagged messages:', error);
    }
}


function saveFlaggedMessages() {
    try {
        fs.writeFileSync(flaggedMessagesFilePath, JSON.stringify(Object.fromEntries(flaggedMessages)));
    } catch (error) {
        console.error('Error saving flagged messages:', error);
    }
}


function loadWarnings() {
    try {
        if (fs.existsSync(warningsFilePath)) {
            return JSON.parse(fs.readFileSync(warningsFilePath, 'utf8'));
        } else {
            return {};
        }
    } catch (error) {
        console.error('Error loading warnings:', error);
        return {};
    }
}


function saveWarnings(warnings) {
    try {
        fs.writeFileSync(warningsFilePath, JSON.stringify(warnings, null, 2));
    } catch (error) {
        console.error('Error saving warnings:', error);
    }
}



client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const botMember = message.guild.members.me;
    if (!botMember) return;


    if (message.member.roles.highest.position >= botMember.roles.highest.position) {
        return;
    }

    const messageContent = message.content.toLowerCase().trim();

    if (messageContent.length < 2) {
        return;
    }

    if (containsBannedWord(messageContent)) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 Warning: Inappropriate Language Detected 🚨')
                .setDescription('Your message has been flagged due to the use of inappropriate language.')
                .addFields(
                    { name: 'Message Content', value: messageContent },
                    { name: 'User', value: `<@${message.author.id}> (${message.author.tag})` },
                    { name: 'User ID', value: message.author.id },
                    { name: 'Channel', value: `<#${message.channel.id}>` }
                )
                .setFooter({ text: 'Please adhere to the community guidelines to avoid further actions.' })
                .setTimestamp();

            const revokeButton = new ButtonBuilder()
                .setCustomId('revoke_timeout')
                .setLabel('Revoke Timeout')
                .setStyle(ButtonStyle.Primary);

            const kickButton = new ButtonBuilder()
                .setCustomId('kick_user')
                .setLabel('Kick User')
                .setStyle(ButtonStyle.Danger);

            const banButton = new ButtonBuilder()
                .setCustomId('ban_user')
                .setLabel('Ban User')
                .setStyle(ButtonStyle.Danger);

            const warnButton = new ButtonBuilder()
                .setCustomId('warn_user')
                .setLabel('Warn User')
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder().addComponents(revokeButton, kickButton, banButton, warnButton);


            const channelId = '1280343199793287241'; 
            const channel = message.guild.channels.cache.get(channelId);

            if (!channel) {
                console.error(`Channel with ID ${channelId} not found.`);
                return;
            }

            const responseMessage = await channel.send({ embeds: [embed], components: [actionRow] });


            flaggedMessages.set(responseMessage.id, {
                content: messageContent,
                authorId: message.author.id,
                channelId: message.channel.id
            });

            const timeoutDuration = 24 * 60 * 60 * 1000; 


            if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                console.error('Bot does not have permission to moderate members.');
                return;
            }

            await message.member.timeout(timeoutDuration, 'Used banned word');

        } catch (error) {
            console.error('Error handling banned word message:', error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;


    if (!interaction.member || !interaction.guild) {
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred. Please try again later.', ephemeral: true });
        }
        return;
    }


    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        console.error('Bot does not have permission to moderate members.');
        if (!interaction.replied) {
            await interaction.reply({ content: 'Bot does not have permission to moderate members.', ephemeral: true });
        }
        return;
    }

    const o5CouncilRoleId = '1206043510239666206'; 
    const hasO5CouncilRole = interaction.member.roles.cache.has(o5CouncilRoleId);

    if (!hasO5CouncilRole) {
        if (!interaction.replied) {
            await interaction.reply({ content: 'You do not have the "O5 Council" role to use this button.', ephemeral: true });
        }
        return;
    }

    try {
        const flaggedMessageData = flaggedMessages.get(interaction.message.id);
        if (!flaggedMessageData) {
            if (!interaction.replied) {
                await interaction.reply({ content: 'Original message details not found.', ephemeral: true });
            }
            return;
        }

        const memberToActOn = interaction.guild.members.cache.get(flaggedMessageData.authorId);
        if (!memberToActOn) {
            if (!interaction.replied) {
                await interaction.reply({ content: 'Unable to find the member to act upon.', ephemeral: true });
            }
            return;
        }


        const highestRole = memberToActOn.roles.highest.position;
        const userHighestRole = interaction.member.roles.highest.position;

        if (highestRole >= userHighestRole) {
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('⚠️ Warning ⚠️')
                .setDescription('You cannot take action against a member with a higher or equal role.')
                .addFields(
                    { name: 'Message Content', value: flaggedMessageData.content },
                    { name: 'User', value: `<@${memberToActOn.id}> (${memberToActOn.user.tag})` },
                    { name: 'Channel', value: `<#${flaggedMessageData.channelId}>` }
                )
                .setFooter({ text: 'Please adhere to the community guidelines.' })
                .setTimestamp();


            if (!interaction.replied) {
                await interaction.reply({ content: 'You cannot take action against a member with higher or equal role.', ephemeral: true });
            }

            const channelId = '1280343199793287241'; 
            const channel = interaction.guild.channels.cache.get(channelId);

            if (channel) {
                await channel.send({ embeds: [embed] });
            } else {
                console.error(`Channel with ID ${channelId} not found.`);
            }

            return;
        }


        let actionDescription = '';
        let color = '';
        let footerText = '';

        if (interaction.customId === 'kick_user' || interaction.customId === 'ban_user') {

            if (memberToActOn.timeout) {
                try {
                    await memberToActOn.timeout(null, 'Timeout removed before kick/ban');
                } catch (error) {
                    console.error('Error removing timeout:', error);
                }
            }

            actionDescription = interaction.customId === 'kick_user' ? 'kicked' : 'banned';
            color = actionDescription === 'banned' ? '#ff0000' : '#ff4500';
            footerText = `User has been ${actionDescription}.`;

            try {
                await memberToActOn.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(color)
                            .setTitle(`🚨 User ${actionDescription.charAt(0).toUpperCase() + actionDescription.slice(1)}ed 🚨`)
                            .setDescription(`You have been ${actionDescription} for using inappropriate language.`)
                            .addFields(
                                { name: 'Reason', value: 'Inappropriate language' },
                                { name: 'Action Taken By', value: `<@${interaction.user.id}> (${interaction.user.tag})` }
                            )
                            .setFooter({ text: 'Inappropriate language' })
                            .setTimestamp()
                    ]
                });
            } catch (dmError) {
                console.error('Error sending DM:', dmError);
            }

            if (interaction.customId === 'kick_user') {
                await memberToActOn.kick('Inappropriate language');
            } else {
                await memberToActOn.ban({ reason: 'Inappropriate language' });
            }

            await interaction.reply({ content: `User has been ${actionDescription}.`, ephemeral: true });

            await interaction.message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor(color)
                        .setTitle('🚨 Action Taken 🚨')
                        .setDescription(`The user has been ${actionDescription}.`)
                        .addFields(
                            { name: 'Original Message Content', value: flaggedMessageData.content },
                            { name: `${actionDescription.charAt(0).toUpperCase() + actionDescription.slice(1)}d By`, value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                            { name: 'User', value: `<@${memberToActOn.id}>` },
                            { name: 'Channel', value: `<#${interaction.message.channel.id}>` }
                        )
                        .setFooter({ text: footerText })
                        .setTimestamp()
                ],
                components: [] 
            });

            const channelId = '1280343199793287241'; 
            const channel = interaction.guild.channels.cache.get(channelId);

            if (channel) {
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(color)
                            .setTitle('🚨 Action Taken 🚨')
                            .setDescription(`The user has been ${actionDescription}.`)
                            .addFields(
                                { name: 'Original Message Content', value: flaggedMessageData.content },
                                { name: `${actionDescription.charAt(0).toUpperCase() + actionDescription.slice(1)}d By`, value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                                { name: 'User', value: `<@${memberToActOn.id}>` },
                                { name: 'Channel', value: `<#${interaction.message.channel.id}>` }
                            )
                    ]
                });
            } else {
                console.error(`Channel with ID ${channelId} not found.`);
            }

            flaggedMessages.delete(interaction.message.id);

        } else if (interaction.customId === 'warn_user') {

            if (memberToActOn.timeout) {
                try {
                    await memberToActOn.timeout(null, 'Timeout removed before warning');
                } catch (error) {
                    console.error('Error removing timeout:', error);
                }
            }


            const warnings = loadWarnings();
            if (!warnings[flaggedMessageData.authorId]) {
                warnings[flaggedMessageData.authorId] = [];
            }
            warnings[flaggedMessageData.authorId].push({
                reason: 'Inappropriate language',
                timestamp: new Date().toISOString()
            });
            saveWarnings(warnings);

            await interaction.reply({ content: 'User has been warned.', ephemeral: true });

            try {
                await memberToActOn.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff9900')
                            .setTitle('⚠️ Warning Issued ⚠️')
                            .setDescription('You have received a warning for using inappropriate language.')
                            .addFields(
                                { name: 'Reason', value: 'Inappropriate language detected.' },
                                { name: 'Warned By', value: `<@${interaction.user.id}> (${interaction.user.tag})` }
                            )
                            .setFooter({ text: 'Please follow the community guidelines to avoid further actions.' })
                            .setTimestamp()
                    ]
                });
            } catch (dmError) {
                console.error('Error sending DM:', dmError);
            }

            await interaction.message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff9900')
                        .setTitle('⚠️ Warning Issued ⚠️')
                        .setDescription('The user has been warned.')
                        .addFields(
                            { name: 'Original Message Content', value: flaggedMessageData.content },
                            { name: 'Warned By', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                            { name: 'User', value: `<@${memberToActOn.id}>` },
                            { name: 'Channel', value: `<#${interaction.message.channel.id}>` }
                        )
                        .setFooter({ text: 'User has been warned.' })
                        .setTimestamp()
                ],
                components: [] 
            });

            const channelId = '1280343199793287241'; 
            const channel = interaction.guild.channels.cache.get(channelId);

            if (channel) {
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff9900')
                            .setTitle('⚠️ Warning Issued ⚠️')
                            .setDescription('The user has been warned.')
                            .addFields(
                                { name: 'Original Message Content', value: flaggedMessageData.content },
                                { name: 'Warned By', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                                { name: 'User', value: `<@${memberToActOn.id}>` },
                                { name: 'Channel', value: `<#${interaction.message.channel.id}>` }
                            )
                    ]
                });
            } else {
                console.error(`Channel with ID ${channelId} not found.`);
            }

            flaggedMessages.delete(interaction.message.id);

        } else if (interaction.customId === 'revoke_timeout') {

            if (memberToActOn.timeout) {
                try {
                    await memberToActOn.timeout(null, 'Timeout revoked by admin');
                } catch (error) {
                    console.error('Error removing timeout:', error);
                }
            }

            await interaction.reply({ content: 'Timeout has been revoked.', ephemeral: true });

            await interaction.message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('✅ Timeout Revoked ✅')
                        .setDescription('The timeout for this message has been revoked.')
                        .addFields(
                            { name: 'Original Message Content', value: flaggedMessageData.content },
                            { name: 'Revoked By', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                            { name: 'User', value: `<@${flaggedMessageData.authorId}>` },
                            { name: 'Channel', value: `<#${flaggedMessageData.channelId}>` }
                        )
                        .setFooter({ text: 'Timeout has been revoked.' })
                        .setTimestamp()
                ],
                components: [] 
            });

            const channelId = '1280343199793287241'; 
            const channel = interaction.guild.channels.cache.get(channelId);

            if (channel) {
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Timeout Revoked ✅')
                            .setDescription('The timeout for this message has been revoked.')
                            .addFields(
                                { name: 'Original Message Content', value: flaggedMessageData.content },
                                { name: 'Revoked By', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                                { name: 'User', value: `<@${flaggedMessageData.authorId}>` },
                                { name: 'Channel', value: `<#${flaggedMessageData.channelId}>` }
                            )
                    ]
                });
            } else {
                console.error(`Channel with ID ${channelId} not found.`);
            }

            flaggedMessages.delete(interaction.message.id);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
});


loadFlaggedMessages();

//----------------------------------------------------Leave Roles Saver System---------------------------------------------------//
const dataFilePath = './restoreroles.json';

client.on('guildMemberRemove', async member => {

    if (member.kickable) {
        const userData = {
            name: member.user.username,
            id: member.user.id,
            roles: member.roles.cache.map(role => ({ id: role.id, name: role.name })),
            timestamp: new Date().toISOString(),
            wasKicked: true,
            wasBanned: false
        };

        const data = loadUserData();
        data[member.user.id] = userData;
        saveUserData(data);
    }
});

client.on('guildBanAdd', async (guild, user) => {

    const member = guild.members.cache.get(user.id);
    if (member) {
        const userData = {
            name: user.username,
            id: user.id,
            roles: member.roles.cache.map(role => ({ id: role.id, name: role.name })),
            timestamp: new Date().toISOString(),
            wasKicked: false,
            wasBanned: true
        };

        const data = loadUserData();
        data[user.id] = userData;
        saveUserData(data);
    }
});

client.on('guildMemberAdd', async member => {

    const data = loadUserData();

    if (data[member.user.id]) {
        const userData = data[member.user.id];

        if (userData.wasBanned || userData.wasKicked) {

            if (userData.wasBanned) {
                console.log(`User ${member.user.tag} was banned previously; roles will not be restored.`);
            } else {
                console.log(`User ${member.user.tag} was kicked previously; roles will not be restored.`);
            }


            delete data[member.user.id];
            saveUserData(data);
            return;
        }

        const rolesToAdd = [];
        try {

            for (const roleData of userData.roles) {
                const role = member.guild.roles.cache.get(roleData.id);
                if (role) {
                    rolesToAdd.push(role.id);
                } else {
                    console.warn(`Role ${roleData.name} (ID: ${roleData.id}) not found in the guild.`);
                }
            }

            if (rolesToAdd.length > 0) {

                await member.roles.add(rolesToAdd, 'Restoring roles upon rejoin');
                console.log(`Roles restored for ${member.user.tag}: ${rolesToAdd.join(', ')}`);
            }


            delete data[member.user.id];
            saveUserData(data);


            const embed = new EmbedBuilder()
                .setColor('#2F3136') 
                .setTitle('Welcome Back!')
                .setDescription(`Hey ${member.user.username}, we’ve missed you! 🎉 Your roles have been restored.`)
                .setThumbnail(member.user.displayAvatarURL({ size: 128, format: 'png' }))
                .addFields(
                    { name: 'Username', value: member.user.username, inline: true },
                    { name: 'User ID', value: member.user.id, inline: true },
                    { name: 'Roles Restored', value: userData.roles.map(role => role.name).join(', ') || 'None', inline: false }
                )
                .setFooter({ text: 'Thank you for being part of our community!' })
                .setTimestamp()
                .setAuthor({ name: 'Role Restoration Service', iconURL: 'https://-icon-url-.png' }); 


            await member.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error restoring roles:', error);

            fs.appendFileSync('error-log.txt', `${new Date().toISOString()} - Error restoring roles for ${member.user.tag}: ${error}\n`);
        }
    }
});


function loadUserData() {
    if (!fs.existsSync(dataFilePath)) {
        return {};
    }

    const rawData = fs.readFileSync(dataFilePath);
    return JSON.parse(rawData);
}

function saveUserData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

//invitesssssssssssssssssssssssssssssssssssssss

    client.guilds.cache.forEach(async (guild) => {
        try {
            const invites = await guild.invites.fetch();
            guild.inviteCache = new Map(invites.map(inv => [inv.code, inv]));
            console.log(`Cached invites for ${guild.name}`);
        } catch (error) {
            console.error(`Failed to fetch invites for ${guild.name}:`, error);
        }
    });



client.on('inviteCreate', async invite => {
    try {
        invite.guild.inviteCache.set(invite.code, invite);  
        const logChannel = invite.guild.channels.cache.get('1280979989809860731');
        
        if (!logChannel) return console.error('Log channel not found!');
        
        const embed = new EmbedBuilder()
            .setTitle('New Invite Created')
            .setColor(0x2f3136)
            .addFields(
                { name: 'Invite Code', value: invite.code, inline: true },
                { name: 'Invite Link', value: invite.url, inline: true },
                { name: 'Created By', value: invite.inviter.tag, inline: true },
                { name: 'Max Uses', value: invite.maxUses === 0 ? 'Unlimited' : `${invite.maxUses}`, inline: true },
                { name: 'Expires In', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true },
                { name: 'Channel', value: invite.channel.name, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Invite Tracker System', iconURL: invite.guild.iconURL() });

        await logChannel.send({ embeds: [embed] });
        console.log(`Logged new invite for ${invite.guild.name}`);
    } catch (error) {
        console.error('Failed to log invite creation:', error);
    }
});


client.on('guildMemberAdd', async member => {
    const guild = member.guild;
    let usedInvite = null;

    try {
        const invitesBefore = guild.inviteCache;  
        const invitesAfter = await guild.invites.fetch();  


        usedInvite = invitesAfter.find(inv => inv.uses > (invitesBefore.get(inv.code)?.uses || 0));
        if (!usedInvite) throw new Error('Invite could not be found or invite cache mismatch.');

        const logChannel = guild.channels.cache.get('1280979989809860731');
        if (!logChannel) throw new Error('Log channel not found!');

        const embed = new EmbedBuilder()
            .setTitle('Invite Used')
            .setColor(0x2f3136)
            .addFields(
                { name: 'Invite Code', value: usedInvite.code, inline: true },
                { name: 'Invite Link', value: usedInvite.url, inline: true },
                { name: 'Used By', value: member.user.tag, inline: true },
                { name: 'Invited By', value: usedInvite.inviter.tag, inline: true },
                { name: 'Total Uses', value: `${usedInvite.uses}`, inline: true },
                { name: 'Max Uses', value: usedInvite.maxUses === 0 ? 'Unlimited' : `${usedInvite.maxUses}`, inline: true },
                { name: 'Expires In', value: usedInvite.expiresAt ? `<t:${Math.floor(usedInvite.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Invite Tracker System', iconURL: guild.iconURL() });

        await logChannel.send({ embeds: [embed] });
        console.log(`Logged used invite for ${member.user.tag}`);


        guild.inviteCache = new Map(invitesAfter.map(inv => [inv.code, inv]));

    } catch (error) {
        console.error(`Error detecting invite usage: ${error.message}`);
    }
});






//NEW ACCCCOUNT SYSSSTEEEM

client.on('guildMemberAdd', async (member) => {

    const daysOldLimit = 7;
    const accountCreationDate = member.user.createdAt;
    const accountAge = Math.floor((Date.now() - accountCreationDate) / (1000 * 60 * 60 * 24));

    if (accountAge < daysOldLimit) {

        const embed = new EmbedBuilder()
            .setTitle('New Account Alert')
            .setDescription(`🚨 **A new account has joined the server:** ${member.user.tag}`)
            .addFields(
                { name: 'Account Age', value: `${accountAge} days old`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(accountCreationDate / 1000)}:R>`, inline: true },
                { name: 'User Bio', value: member.user.bio || 'No bio set', inline: true }
            )
            .setColor('Red')
            .setTimestamp();


        const actionRow = new ActionRowBuilder()
            .addComponents(
                
                new ButtonBuilder()
                    .setCustomId('kick')
                    .setLabel('Kick')
                    .setStyle(ButtonStyle.Danger),
            );

        const alertChannel = await client.channels.fetch('1280343199793287241'); 
        await alertChannel.send({
            content: `<@${member.id}> is suspected of being an alt account.`,
            embeds: [embed],
            components: [actionRow]
        });
    }
});

//ANTI CRTASSSSSSSSSSSSH



const logChannelId = '1281426039150612511';

process.on('unhandledRejection', (reason, p) => {
    logError('Unhandled Rejection', reason);
});

process.on('uncaughtException', (err) => {
    logError('Uncaught Exception', err);
});

process.on('warning', (warning) => {
    logError('Warning', warning);
});

process.on('rejectionHandled', (p) => {
    logError('Handled Rejection', p);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    logError('Uncaught Exception Monitor', { err, origin });
});

function logError(errorType, errorDetail) {
    const timeNow = Math.floor(Date.now() / 1000);

    const errorEmbed = new EmbedBuilder()
        .setColor('#2F3136') 
        .setTitle('🚨 **System Crash Alert**')
        .setThumbnail('https://.png') 
        .setDescription('A critical issue has occurred in the system. Please review the details below.')
        .addFields(
            { name: '💥 **Crash Type**', value: `\`${errorType}\``, inline: true },
            { name: '🕒 **Occurred At**', value: `<t:${timeNow}:F> (<t:${timeNow}:R>)`, inline: true },
            { name: '💻 **System Info**', value: `**OS**: ${process.platform}\n**Node.js Version**: ${process.version}\n**Memory Usage**: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: false },
            { name: '📝 **Error Details**', value: `\`\`\`js\n${errorDetail.stack || errorDetail}\n\`\`\``, inline: false },
            { name: '📂 **Path**', value: `\`${process.cwd()}\``, inline: false },
        )
        .setFooter({
            text: 'Anti-Crash System | Enhanced Logging',
            iconURL: 'https://.png' 
        })
        .setTimestamp()
        .setImage('https://.png'); 

    const logChannel = client.channels.cache.get(logChannelId);
    if (logChannel) {
        logChannel.send({ embeds: [errorEmbed] }).catch(console.error);
    }
}