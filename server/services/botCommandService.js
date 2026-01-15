/**
 * Bot Command Service
 * Handles !commands in text channels for all bots
 */

class BotCommandService {
  constructor(io, services = {}) {
    this.io = io;
    this.services = services;

    // Command registry: command -> { handler, description, usage, adminOnly }
    this.commands = new Map();

    // Register all bot commands
    this.registerCommands();
  }

  setServices(services) {
    this.services = { ...this.services, ...services };
  }

  registerCommands() {
    // Image Search Bot
    this.register('img', {
      handler: this.handleImageSearch.bind(this),
      description: 'Search for images',
      usage: '!img <search query>',
      aliases: ['imagesearch', 'image', 'images']
    });

    // YouTube Bot
    this.register('play', {
      handler: this.handleYouTubePlay.bind(this),
      description: 'Play a YouTube video',
      usage: '!play <youtube url or search>',
      aliases: ['youtube', 'yt']
    });

    this.register('stop', {
      handler: this.handleYouTubeStop.bind(this),
      description: 'Stop YouTube playback',
      usage: '!stop'
    });

    this.register('pause', {
      handler: this.handleYouTubePause.bind(this),
      description: 'Pause YouTube playback',
      usage: '!pause'
    });

    this.register('resume', {
      handler: this.handleYouTubeResume.bind(this),
      description: 'Resume YouTube playback',
      usage: '!resume'
    });

    // Chrome Bot
    this.register('browse', {
      handler: this.handleChromeBrowse.bind(this),
      description: 'Open a URL in shared browser',
      usage: '!browse <url>',
      aliases: ['url', 'open']
    });

    this.register('google', {
      handler: this.handleGoogleSearch.bind(this),
      description: 'Google search in shared browser',
      usage: '!google <search query>',
      aliases: ['search']
    });

    // Twitch Bot
    this.register('twitch', {
      handler: this.handleTwitchWatch.bind(this),
      description: 'Watch a Twitch stream',
      usage: '!twitch <channel name>',
      aliases: ['watch', 'stream']
    });

    // Emulator Bot
    this.register('games', {
      handler: this.handleEmulatorListGames.bind(this),
      description: 'List available games',
      usage: '!games [emulator]',
      aliases: ['listgames', 'gamelist']
    });

    this.register('launch', {
      handler: this.handleEmulatorLaunch.bind(this),
      description: 'Launch a game',
      usage: '!launch <game name>',
      aliases: ['startgame', 'playgame']
    });

    // AI Chat Bot
    this.register('chat', {
      handler: this.handleAIChat.bind(this),
      description: 'Chat with AI',
      usage: '!chat <message>',
      aliases: ['ai', 'ask']
    });

    // Poll Bot
    this.register('poll', {
      handler: this.handlePollCreate.bind(this),
      description: 'Create a poll',
      usage: '!poll <question> | <option1> | <option2> | ...'
    });

    this.register('vote', {
      handler: this.handlePollVote.bind(this),
      description: 'Vote in active poll',
      usage: '!vote <option number>'
    });

    // Trivia Bot
    this.register('trivia', {
      handler: this.handleTriviaStart.bind(this),
      description: 'Start a trivia question',
      usage: '!trivia [category]'
    });

    this.register('answer', {
      handler: this.handleTriviaAnswer.bind(this),
      description: 'Answer trivia question',
      usage: '!answer <your answer>',
      aliases: ['a']
    });

    // Facts Bot
    this.register('fact', {
      handler: this.handleRandomFact.bind(this),
      description: 'Get a random fact',
      usage: '!fact [category]',
      aliases: ['facts', 'randomfact']
    });

    // RPG Bot
    this.register('rpg', {
      handler: this.handleRPG.bind(this),
      description: 'RPG commands',
      usage: '!rpg <start|stats|attack|heal|inventory>'
    });

    // Star Citizen Bot
    this.register('sc', {
      handler: this.handleStarCitizen.bind(this),
      description: 'Star Citizen info',
      usage: '!sc <status|ship|org|player>',
      aliases: ['starcitizen']
    });

    // Activity Stats
    this.register('stats', {
      handler: this.handleStats.bind(this),
      description: 'View activity stats',
      usage: '!stats [user]',
      aliases: ['activity', 'leaderboard']
    });

    // Spotify Bot
    this.register('spotify', {
      handler: this.handleSpotify.bind(this),
      description: 'Spotify controls',
      usage: '!spotify <play|pause|skip|queue>',
      aliases: ['sp']
    });

    // Help command
    this.register('help', {
      handler: this.handleHelp.bind(this),
      description: 'Show available commands',
      usage: '!help [command]',
      aliases: ['commands', 'h', '?']
    });
  }

  register(command, config) {
    this.commands.set(command.toLowerCase(), config);

    // Register aliases
    if (config.aliases) {
      for (const alias of config.aliases) {
        this.commands.set(alias.toLowerCase(), { ...config, isAlias: true, mainCommand: command });
      }
    }
  }

  /**
   * Process a message and check for bot commands
   * Returns { isCommand: boolean, response: object|null }
   */
  async processMessage(message, channelId, user, voiceChannelId = null) {
    const content = message.trim();

    // Check if message starts with !
    if (!content.startsWith('!')) {
      return { isCommand: false, response: null };
    }

    // Parse command and args
    const parts = content.slice(1).split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    // Find command
    const command = this.commands.get(commandName);
    if (!command) {
      return { isCommand: false, response: null };
    }

    // Execute command
    try {
      const result = await command.handler({
        args,
        channelId,
        voiceChannelId,
        user,
        rawMessage: content
      });

      return {
        isCommand: true,
        response: result
      };
    } catch (error) {
      console.error(`Bot command error (${commandName}):`, error);
      return {
        isCommand: true,
        response: {
          type: 'error',
          content: `Error: ${error.message}`
        }
      };
    }
  }

  // Send bot response to channel
  sendBotResponse(channelId, response) {
    if (!response) return;

    this.io.to(`channel:${channelId}`).emit('bot:response', {
      channelId,
      bot: response.bot || 'System',
      type: response.type || 'text',
      content: response.content,
      data: response.data,
      timestamp: Date.now()
    });
  }

  // ===== Command Handlers =====

  async handleImageSearch({ args, channelId }) {
    if (!args) {
      return { type: 'error', bot: 'ImageBot', content: 'Please provide a search query. Usage: !img <query>' };
    }

    const imageBot = this.services.imageBot;
    if (!imageBot || !imageBot.enabled) {
      return { type: 'error', bot: 'ImageBot', content: 'Image search bot is not enabled.' };
    }

    try {
      const results = await imageBot.search(args);
      return {
        type: 'images',
        bot: 'ImageBot',
        content: `Found ${results.length} images for "${args}"`,
        data: { query: args, images: results.slice(0, 5) }
      };
    } catch (error) {
      return { type: 'error', bot: 'ImageBot', content: error.message };
    }
  }

  async handleYouTubePlay({ args, channelId, voiceChannelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'YouTubeBot', content: 'Please provide a YouTube URL. Usage: !play <url>' };
    }

    const ytBot = this.services.youtubeBot;
    if (!ytBot || !ytBot.enabled) {
      return { type: 'error', bot: 'YouTubeBot', content: 'YouTube bot is not enabled.' };
    }

    const targetChannel = voiceChannelId || channelId;

    try {
      const result = await ytBot.play(targetChannel, args, user.username);
      return {
        type: 'youtube',
        bot: 'YouTubeBot',
        content: `Now playing: ${result.title}`,
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'YouTubeBot', content: error.message };
    }
  }

  async handleYouTubeStop({ channelId, voiceChannelId }) {
    const ytBot = this.services.youtubeBot;
    if (!ytBot) {
      return { type: 'error', bot: 'YouTubeBot', content: 'YouTube bot is not available.' };
    }

    const targetChannel = voiceChannelId || channelId;
    ytBot.stop(targetChannel);
    return { type: 'info', bot: 'YouTubeBot', content: 'Playback stopped.' };
  }

  async handleYouTubePause({ channelId, voiceChannelId }) {
    const ytBot = this.services.youtubeBot;
    if (!ytBot) {
      return { type: 'error', bot: 'YouTubeBot', content: 'YouTube bot is not available.' };
    }

    const targetChannel = voiceChannelId || channelId;
    ytBot.pause(targetChannel);
    return { type: 'info', bot: 'YouTubeBot', content: 'Playback paused.' };
  }

  async handleYouTubeResume({ channelId, voiceChannelId }) {
    const ytBot = this.services.youtubeBot;
    if (!ytBot) {
      return { type: 'error', bot: 'YouTubeBot', content: 'YouTube bot is not available.' };
    }

    const targetChannel = voiceChannelId || channelId;
    ytBot.resume(targetChannel);
    return { type: 'info', bot: 'YouTubeBot', content: 'Playback resumed.' };
  }

  async handleChromeBrowse({ args, channelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'ChromeBot', content: 'Please provide a URL. Usage: !browse <url>' };
    }

    const chromeBot = this.services.chromeBot;
    if (!chromeBot || !chromeBot.enabled) {
      return { type: 'error', bot: 'ChromeBot', content: 'Chrome bot is not enabled.' };
    }

    // Add https if missing
    let url = args;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      // Check if session exists, start one if not
      let session = chromeBot.getSession(channelId);
      if (!session) {
        chromeBot.startSession(channelId, url, user.username);
        return {
          type: 'chrome',
          bot: 'ChromeBot',
          content: `Started browser session: ${url}`,
          data: { url, action: 'start' }
        };
      } else {
        chromeBot.navigate(channelId, url, user.username);
        return {
          type: 'chrome',
          bot: 'ChromeBot',
          content: `Navigating to: ${url}`,
          data: { url, action: 'navigate' }
        };
      }
    } catch (error) {
      return { type: 'error', bot: 'ChromeBot', content: error.message };
    }
  }

  async handleGoogleSearch({ args, channelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'ChromeBot', content: 'Please provide a search query. Usage: !google <query>' };
    }

    const chromeBot = this.services.chromeBot;
    if (!chromeBot || !chromeBot.enabled) {
      return { type: 'error', bot: 'ChromeBot', content: 'Chrome bot is not enabled.' };
    }

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args)}`;

    try {
      let session = chromeBot.getSession(channelId);
      if (!session) {
        chromeBot.startSession(channelId, searchUrl, user.username);
      } else {
        chromeBot.navigate(channelId, searchUrl, user.username);
      }
      return {
        type: 'chrome',
        bot: 'ChromeBot',
        content: `Searching Google for: ${args}`,
        data: { url: searchUrl, query: args }
      };
    } catch (error) {
      return { type: 'error', bot: 'ChromeBot', content: error.message };
    }
  }

  async handleTwitchWatch({ args, channelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'TwitchBot', content: 'Please provide a channel name. Usage: !twitch <channel>' };
    }

    const twitchBot = this.services.twitchBot;
    if (!twitchBot || !twitchBot.enabled) {
      return { type: 'error', bot: 'TwitchBot', content: 'Twitch bot is not enabled.' };
    }

    try {
      const result = await twitchBot.watchStream(channelId, args, user.username);
      return {
        type: 'twitch',
        bot: 'TwitchBot',
        content: `Now watching: ${args}`,
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'TwitchBot', content: error.message };
    }
  }

  async handleEmulatorListGames({ args, channelId }) {
    const emulatorBot = this.services.emulatorBot;
    if (!emulatorBot || !emulatorBot.enabled) {
      return { type: 'error', bot: 'EmulatorBot', content: 'Emulator bot is not enabled.' };
    }

    try {
      const games = emulatorBot.listGames ? emulatorBot.listGames(args) : [];
      if (games.length === 0) {
        return { type: 'info', bot: 'EmulatorBot', content: 'No games available.' };
      }

      const gameList = games.slice(0, 10).map((g, i) => `${i + 1}. ${g.name}`).join('\n');
      return {
        type: 'list',
        bot: 'EmulatorBot',
        content: `Available games:\n${gameList}`,
        data: { games: games.slice(0, 10) }
      };
    } catch (error) {
      return { type: 'error', bot: 'EmulatorBot', content: error.message };
    }
  }

  async handleEmulatorLaunch({ args, channelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'EmulatorBot', content: 'Please specify a game. Usage: !launch <game name>' };
    }

    const emulatorBot = this.services.emulatorBot;
    if (!emulatorBot || !emulatorBot.enabled) {
      return { type: 'error', bot: 'EmulatorBot', content: 'Emulator bot is not enabled.' };
    }

    try {
      const result = emulatorBot.launchGame ? emulatorBot.launchGame(channelId, args, user.username) : null;
      if (!result) {
        return { type: 'error', bot: 'EmulatorBot', content: 'Game not found or launch failed.' };
      }
      return {
        type: 'emulator',
        bot: 'EmulatorBot',
        content: `Launching: ${result.game}`,
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'EmulatorBot', content: error.message };
    }
  }

  async handleAIChat({ args, channelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'AIChat', content: 'Please provide a message. Usage: !chat <message>' };
    }

    const aiBot = this.services.aiBot;
    if (!aiBot || !aiBot.enabled) {
      return { type: 'error', bot: 'AIChat', content: 'AI chat bot is not enabled.' };
    }

    try {
      const response = await aiBot.chat(args, user.username);
      return {
        type: 'ai',
        bot: 'AIChat',
        content: response,
        data: { query: args }
      };
    } catch (error) {
      return { type: 'error', bot: 'AIChat', content: error.message };
    }
  }

  async handlePollCreate({ args, channelId, user }) {
    if (!args || !args.includes('|')) {
      return {
        type: 'error',
        bot: 'PollBot',
        content: 'Please provide a question and options separated by |. Usage: !poll Question | Option1 | Option2'
      };
    }

    const pollBot = this.services.pollBot;
    if (!pollBot) {
      // Create simple in-memory poll
      const parts = args.split('|').map(p => p.trim());
      const question = parts[0];
      const options = parts.slice(1);

      if (options.length < 2) {
        return { type: 'error', bot: 'PollBot', content: 'Please provide at least 2 options.' };
      }

      // Store poll in service or memory
      this.activePoll = this.activePoll || {};
      this.activePoll[channelId] = {
        question,
        options,
        votes: {},
        createdBy: user.username,
        createdAt: Date.now()
      };

      const optionsList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
      return {
        type: 'poll',
        bot: 'PollBot',
        content: `**Poll: ${question}**\n${optionsList}\n\nVote with !vote <number>`,
        data: { question, options }
      };
    }

    try {
      const result = pollBot.createPoll(channelId, args, user.username);
      return {
        type: 'poll',
        bot: 'PollBot',
        content: result.message,
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'PollBot', content: error.message };
    }
  }

  async handlePollVote({ args, channelId, user }) {
    const voteNum = parseInt(args);
    if (isNaN(voteNum)) {
      return { type: 'error', bot: 'PollBot', content: 'Please provide a valid option number. Usage: !vote <number>' };
    }

    // Check for active poll
    this.activePoll = this.activePoll || {};
    const poll = this.activePoll[channelId];

    if (!poll) {
      return { type: 'error', bot: 'PollBot', content: 'No active poll in this channel.' };
    }

    if (voteNum < 1 || voteNum > poll.options.length) {
      return { type: 'error', bot: 'PollBot', content: `Please vote for option 1-${poll.options.length}.` };
    }

    // Record vote
    poll.votes[user._id || user.username] = voteNum;

    // Count votes
    const voteCounts = {};
    for (const v of Object.values(poll.votes)) {
      voteCounts[v] = (voteCounts[v] || 0) + 1;
    }

    const results = poll.options.map((o, i) => `${o}: ${voteCounts[i + 1] || 0} votes`).join('\n');
    return {
      type: 'poll',
      bot: 'PollBot',
      content: `${user.username} voted for "${poll.options[voteNum - 1]}"\n\n**Current Results:**\n${results}`,
      data: { vote: voteNum, voteCounts }
    };
  }

  async handleTriviaStart({ args, channelId }) {
    const triviaBot = this.services.triviaBot;

    // Simple trivia if no bot service
    if (!triviaBot) {
      const triviaQuestions = [
        { q: 'What is the capital of France?', a: 'paris' },
        { q: 'What year did World War II end?', a: '1945' },
        { q: 'What planet is known as the Red Planet?', a: 'mars' },
        { q: 'Who painted the Mona Lisa?', a: 'leonardo da vinci' },
        { q: 'What is the largest ocean on Earth?', a: 'pacific' }
      ];

      const question = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
      this.activeTrivia = this.activeTrivia || {};
      this.activeTrivia[channelId] = { ...question, startTime: Date.now() };

      return {
        type: 'trivia',
        bot: 'TriviaBot',
        content: `**Trivia Question:**\n${question.q}\n\nAnswer with !answer <your answer>`,
        data: { question: question.q }
      };
    }

    try {
      const result = triviaBot.startQuestion(channelId, args);
      return {
        type: 'trivia',
        bot: 'TriviaBot',
        content: result.question,
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'TriviaBot', content: error.message };
    }
  }

  async handleTriviaAnswer({ args, channelId, user }) {
    if (!args) {
      return { type: 'error', bot: 'TriviaBot', content: 'Please provide an answer. Usage: !answer <your answer>' };
    }

    this.activeTrivia = this.activeTrivia || {};
    const trivia = this.activeTrivia[channelId];

    if (!trivia) {
      return { type: 'error', bot: 'TriviaBot', content: 'No active trivia question. Start one with !trivia' };
    }

    const correct = args.toLowerCase().includes(trivia.a.toLowerCase());

    if (correct) {
      delete this.activeTrivia[channelId];
      return {
        type: 'trivia',
        bot: 'TriviaBot',
        content: `Correct! ${user.username} got it right! The answer was: ${trivia.a}`,
        data: { correct: true, winner: user.username }
      };
    } else {
      return {
        type: 'trivia',
        bot: 'TriviaBot',
        content: `Sorry ${user.username}, that's not correct. Try again!`,
        data: { correct: false }
      };
    }
  }

  async handleRandomFact({ args }) {
    const factsBot = this.services.factsBot;

    // Simple facts if no bot service
    if (!factsBot) {
      const facts = [
        'Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.',
        'Octopuses have three hearts and blue blood.',
        'A group of flamingos is called a "flamboyance".',
        'The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.',
        'Bananas are berries, but strawberries aren\'t.',
        'The inventor of the Pringles can is buried in one.',
        'Cows have best friends and get stressed when separated.',
        'A day on Venus is longer than a year on Venus.'
      ];

      const fact = facts[Math.floor(Math.random() * facts.length)];
      return {
        type: 'fact',
        bot: 'FactsBot',
        content: `**Random Fact:**\n${fact}`,
        data: { fact }
      };
    }

    try {
      const result = factsBot.getFact(args);
      return {
        type: 'fact',
        bot: 'FactsBot',
        content: result,
        data: { fact: result }
      };
    } catch (error) {
      return { type: 'error', bot: 'FactsBot', content: error.message };
    }
  }

  async handleRPG({ args, channelId, user }) {
    const rpgBot = this.services.rpgBot;
    if (!rpgBot || !rpgBot.enabled) {
      return { type: 'error', bot: 'RPGBot', content: 'RPG bot is not enabled.' };
    }

    const subcommand = args ? args.split(' ')[0].toLowerCase() : 'help';
    const subargs = args ? args.split(' ').slice(1).join(' ') : '';

    try {
      let result;
      switch (subcommand) {
        case 'start':
          result = rpgBot.startGame ? rpgBot.startGame(user._id || user.username) : null;
          break;
        case 'stats':
          result = rpgBot.getStats ? rpgBot.getStats(user._id || user.username) : null;
          break;
        case 'attack':
          result = rpgBot.attack ? rpgBot.attack(user._id || user.username, subargs) : null;
          break;
        case 'heal':
          result = rpgBot.heal ? rpgBot.heal(user._id || user.username) : null;
          break;
        case 'inventory':
          result = rpgBot.getInventory ? rpgBot.getInventory(user._id || user.username) : null;
          break;
        default:
          return {
            type: 'info',
            bot: 'RPGBot',
            content: 'RPG Commands:\n!rpg start - Start your adventure\n!rpg stats - View your stats\n!rpg attack <enemy> - Attack an enemy\n!rpg heal - Heal yourself\n!rpg inventory - View your inventory'
          };
      }

      return {
        type: 'rpg',
        bot: 'RPGBot',
        content: result?.message || 'Command executed.',
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'RPGBot', content: error.message };
    }
  }

  async handleStarCitizen({ args }) {
    const scBot = this.services.scBot;
    if (!scBot || !scBot.enabled) {
      return { type: 'error', bot: 'StarCitizenBot', content: 'Star Citizen bot is not enabled.' };
    }

    const subcommand = args ? args.split(' ')[0].toLowerCase() : 'help';
    const subargs = args ? args.split(' ').slice(1).join(' ') : '';

    try {
      let result;
      switch (subcommand) {
        case 'status':
          result = scBot.getServerStatus ? await scBot.getServerStatus() : null;
          break;
        case 'ship':
          result = scBot.getShipInfo ? await scBot.getShipInfo(subargs) : null;
          break;
        case 'org':
          result = scBot.getOrgInfo ? await scBot.getOrgInfo(subargs) : null;
          break;
        case 'player':
          result = scBot.getPlayerInfo ? await scBot.getPlayerInfo(subargs) : null;
          break;
        default:
          return {
            type: 'info',
            bot: 'StarCitizenBot',
            content: 'Star Citizen Commands:\n!sc status - Server status\n!sc ship <name> - Ship info\n!sc org <name> - Organization info\n!sc player <name> - Player info'
          };
      }

      return {
        type: 'sc',
        bot: 'StarCitizenBot',
        content: result?.message || JSON.stringify(result, null, 2),
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'StarCitizenBot', content: error.message };
    }
  }

  async handleStats({ args, channelId, user }) {
    const activityBot = this.services.activityBot;
    if (!activityBot || !activityBot.enabled) {
      return { type: 'error', bot: 'ActivityBot', content: 'Activity stats bot is not enabled.' };
    }

    try {
      const targetUser = args || user.username;
      const stats = activityBot.getStats ? activityBot.getStats(targetUser) : null;

      if (!stats) {
        return { type: 'info', bot: 'ActivityBot', content: `No stats found for ${targetUser}.` };
      }

      return {
        type: 'stats',
        bot: 'ActivityBot',
        content: `**Stats for ${targetUser}:**\nMessages: ${stats.messages || 0}\nVoice Time: ${stats.voiceTime || 0} min\nGames Played: ${stats.gamesPlayed || 0}`,
        data: stats
      };
    } catch (error) {
      return { type: 'error', bot: 'ActivityBot', content: error.message };
    }
  }

  async handleSpotify({ args, channelId, user }) {
    const spotifyBot = this.services.spotifyBot;
    if (!spotifyBot || !spotifyBot.enabled) {
      return { type: 'error', bot: 'SpotifyBot', content: 'Spotify bot is not enabled.' };
    }

    const subcommand = args ? args.split(' ')[0].toLowerCase() : 'help';
    const subargs = args ? args.split(' ').slice(1).join(' ') : '';

    try {
      let result;
      switch (subcommand) {
        case 'play':
          result = spotifyBot.play ? await spotifyBot.play(channelId, subargs, user.username) : null;
          break;
        case 'pause':
          result = spotifyBot.pause ? spotifyBot.pause(channelId) : null;
          break;
        case 'skip':
          result = spotifyBot.skip ? spotifyBot.skip(channelId) : null;
          break;
        case 'queue':
          result = spotifyBot.getQueue ? spotifyBot.getQueue(channelId) : null;
          break;
        default:
          return {
            type: 'info',
            bot: 'SpotifyBot',
            content: 'Spotify Commands:\n!spotify play <song> - Play a song\n!spotify pause - Pause playback\n!spotify skip - Skip current song\n!spotify queue - View queue'
          };
      }

      return {
        type: 'spotify',
        bot: 'SpotifyBot',
        content: result?.message || 'Command executed.',
        data: result
      };
    } catch (error) {
      return { type: 'error', bot: 'SpotifyBot', content: error.message };
    }
  }

  async handleHelp({ args }) {
    if (args) {
      const command = this.commands.get(args.toLowerCase());
      if (command) {
        const mainCmd = command.isAlias ? command.mainCommand : args.toLowerCase();
        const mainConfig = command.isAlias ? this.commands.get(command.mainCommand) : command;

        let helpText = `**!${mainCmd}**\n${mainConfig.description}\nUsage: ${mainConfig.usage}`;
        if (mainConfig.aliases && mainConfig.aliases.length > 0) {
          helpText += `\nAliases: ${mainConfig.aliases.map(a => '!' + a).join(', ')}`;
        }
        return {
          type: 'help',
          bot: 'System',
          content: helpText
        };
      } else {
        return { type: 'error', bot: 'System', content: `Unknown command: ${args}` };
      }
    }

    // List all commands (excluding aliases)
    const commands = [];
    for (const [name, config] of this.commands) {
      if (!config.isAlias) {
        commands.push(`**!${name}** - ${config.description}`);
      }
    }

    return {
      type: 'help',
      bot: 'System',
      content: `**Available Commands:**\n${commands.join('\n')}\n\nType !help <command> for more info.`
    };
  }
}

module.exports = { BotCommandService };
