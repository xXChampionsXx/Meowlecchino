import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  Guild,
  Message,
} from "discord.js";
import { config } from "./config";
import { commands } from "./commands";
import { deployCommands } from "./deploy-commands";

const MAX_DUPLICATES = 4;
const MAX_AVERAGE_TIME = 3000;

const TIMEOUT_AMOUNT = 1 * 24 * 60 * 60 * 1000;

const messages = new Map<String, MessageWTimestamp[]>();

const client = new Client({
  intents: [
    "Guilds",
    "GuildMessages",
    "GuildBans",
    "GuildMembers",
    "GuildModeration",
    "DirectMessages",
    "MessageContent",
  ],
});

client.once("ready", () => {
  console.log("Discord bot is ready! 🤖");
});

/*client.on("guildCreate", async (guild) => {
  await deployCommands({ guildId: guild.id });
});*/

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const action = interaction.customId;
    const user = interaction.message.mentions.members?.map(
      (member) => member
    )[0].user;
    if (action === "ban" && user) {
      interaction.guild?.members.ban(user.id, {
        reason: "Bot-Spamming (Meowlecchino)",
      });
      interaction.reply(`Succesfully banned <@${user.id}>`);
    } else if (action === "forgive" && user) {
      interaction.guild?.members.edit(user, {
        communicationDisabledUntil: null,
      });
      interaction.reply(`Removed timeout from <@${user.id}>`);
    }
  }
});

type MessageWTimestamp = {
  content: string;
  timestamp: number;
};

client.on(Events.MessageCreate, async (msg) => {
  if (msg.guild) fetchUserMessages(msg.guild, msg.author.id);
  console.log("Message received: " + msg.author.id + " " + msg.content);

  if (messages.has(msg.author.id)) {
    let authorMessages = messages.get(msg.author.id) as MessageWTimestamp[];
    authorMessages?.push({
      content: msg.content,
      timestamp: Date.now(),
    });

    if (authorMessages.length < MAX_DUPLICATES) return;

    let duplicates = 0;
    let averageTime = 0;
    for (let i = 0; i < authorMessages.length - 1; i++) {
      if (authorMessages[i].content === authorMessages[i + 1].content) {
        duplicates++;
        averageTime +=
          authorMessages[i + 1].timestamp - authorMessages[i].timestamp;
      }
    }
    averageTime /= authorMessages.length;

    console.log(
      msg.author.id +
        " sent " +
        duplicates +
        " duplicates with an average pause of " +
        averageTime +
        "ms"
    );
    authorMessages.shift();
    messages.set(msg.author.id, authorMessages);

    if (duplicates >= MAX_DUPLICATES - 1 && averageTime <= MAX_AVERAGE_TIME) {
      console.log("SPAM!!!!!!!");
      msg.guild?.members.edit(msg.author, {
        communicationDisabledUntil: new Date(Date.now() + TIMEOUT_AMOUNT),
      });
      console.log("Timed out for 24 hours.");

      const modChannel = await msg.guild?.channels.fetch(
        config.DISCORD_MODERATION_CHANNEL_ID
      );
      if (modChannel?.isTextBased()) {
        const banBtn = new ButtonBuilder()
          .setCustomId("ban")
          .setLabel("Ban")
          .setStyle(ButtonStyle.Danger);

        const forgiveBtn = new ButtonBuilder()
          .setCustomId("forgive")
          .setLabel("Forgive")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          banBtn,
          forgiveBtn
        );

        modChannel.send({
          content: `<@${msg.author.id}> was spamming the following message https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`,
          components: [row],
        });
      }
    }
  } else {
    messages.set(msg.author.id, [
      {
        content: msg.content,
        timestamp: Date.now(),
      },
    ]);
  }
});

client.login(config.DISCORD_TOKEN);

async function fetchUserMessages(guild: Guild, userId: string) {
  const userMessages: Message<boolean>[] = [];

  for (const ch of guild.channels.cache) {
    const channel = ch[1];
    if (channel.isTextBased()) {
      try {
        const messages = await channel.messages.fetch({ limit: 10 }); // Fetch the last 10 messages from the channel
        const userMessagesInChannel = messages
          .filter((msg) => msg.author.id === userId)
          .map((msg) => msg);
        userMessages.push(...userMessagesInChannel);
      } catch (error) {
        console.error(
          `Error fetching messages in channel ${channel.name}: ${error}`
        );
      }
    }
  }

  return userMessages;
}
