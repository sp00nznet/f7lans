const RPGCampaign = require('../models/RPGCampaign');

// Adventure templates by setting
const adventureTemplates = {
  fantasy: {
    starts: [
      'You find yourself at the entrance of an ancient dungeon, its stone archway covered in mysterious runes.',
      'A desperate villager approaches you in the tavern, begging for help to rescue their family from goblins.',
      'The king\'s messenger finds you - a dragon has been spotted near the eastern mountains.',
      'You wake up in a forest clearing with no memory of how you got there. Strange whispers echo through the trees.',
      'A mysterious merchant offers you a map to a legendary treasure hidden in the Cursed Swamp.'
    ],
    encounters: [
      { name: 'Goblin', hp: 8, attack: 3, defense: 10, damage: '1d6', xp: 25 },
      { name: 'Skeleton Warrior', hp: 13, attack: 4, defense: 12, damage: '1d8', xp: 50 },
      { name: 'Giant Spider', hp: 20, attack: 5, defense: 11, damage: '1d8+1', xp: 75 },
      { name: 'Orc Berserker', hp: 30, attack: 6, defense: 13, damage: '1d10+2', xp: 100 },
      { name: 'Troll', hp: 50, attack: 7, defense: 14, damage: '2d6+3', xp: 200 },
      { name: 'Dark Mage', hp: 35, attack: 8, defense: 11, damage: '2d8', xp: 250 }
    ],
    locations: ['dungeon', 'forest', 'castle', 'cave', 'village', 'temple', 'swamp', 'mountains'],
    treasures: ['gold coins', 'healing potion', 'enchanted sword', 'magic ring', 'ancient scroll', 'gem']
  },
  scifi: {
    starts: [
      'Your ship crashes on an uncharted planet. Warning lights flash as systems fail one by one.',
      'A distress signal leads you to an abandoned space station. Something moved in the shadows.',
      'The corporation has sent you to investigate a mining colony that went silent three days ago.',
      'You\'re hired to transport cargo through pirate territory. The pay is too good to refuse.',
      'A rogue AI has taken control of the orbital defense platform. You\'re humanity\'s last hope.'
    ],
    encounters: [
      { name: 'Security Drone', hp: 10, attack: 3, defense: 12, damage: '1d8', xp: 30 },
      { name: 'Alien Creature', hp: 20, attack: 5, defense: 10, damage: '1d10', xp: 60 },
      { name: 'Pirate Raider', hp: 25, attack: 4, defense: 13, damage: '1d8+2', xp: 80 },
      { name: 'Combat Mech', hp: 45, attack: 7, defense: 15, damage: '2d6+2', xp: 150 },
      { name: 'Xenomorph', hp: 40, attack: 8, defense: 12, damage: '2d8', xp: 200 }
    ],
    locations: ['space station', 'alien planet', 'starship', 'colony', 'asteroid', 'research lab'],
    treasures: ['credits', 'med-kit', 'plasma rifle', 'shield module', 'data chip', 'rare element']
  },
  horror: {
    starts: [
      'The old mansion looms before you. They say no one who enters ever returns.',
      'You wake up in a hospital bed. The halls are empty, and something is scratching at your door.',
      'The fog rolls into town thicker than ever. When it clears, people have vanished.',
      'A séance gone wrong has opened a portal. Dark entities are seeping into our world.',
      'The asylum was supposed to be abandoned. The screams from within say otherwise.'
    ],
    encounters: [
      { name: 'Shambling Corpse', hp: 15, attack: 3, defense: 8, damage: '1d6+1', xp: 40 },
      { name: 'Shadow Creature', hp: 20, attack: 5, defense: 11, damage: '1d8', xp: 70 },
      { name: 'Possessed Human', hp: 25, attack: 4, defense: 12, damage: '1d8+2', xp: 90 },
      { name: 'Nightmare Beast', hp: 40, attack: 7, defense: 13, damage: '2d6+2', xp: 160 },
      { name: 'Eldritch Horror', hp: 60, attack: 9, defense: 14, damage: '2d10', xp: 300 }
    ],
    locations: ['mansion', 'asylum', 'cemetery', 'forest', 'abandoned town', 'catacombs'],
    treasures: ['ancient tome', 'protective amulet', 'holy water', 'silver dagger', 'mysterious key', 'sanity potion']
  }
};

// Class templates
const classTemplates = {
  warrior: { hp: 12, stats: { strength: 15, constitution: 14, dexterity: 10, intelligence: 8, wisdom: 10, charisma: 10 } },
  mage: { hp: 6, stats: { strength: 8, constitution: 10, dexterity: 10, intelligence: 16, wisdom: 14, charisma: 10 } },
  rogue: { hp: 8, stats: { strength: 10, constitution: 10, dexterity: 16, intelligence: 12, wisdom: 10, charisma: 12 } },
  cleric: { hp: 8, stats: { strength: 12, constitution: 12, dexterity: 8, intelligence: 10, wisdom: 16, charisma: 12 } },
  ranger: { hp: 10, stats: { strength: 12, constitution: 12, dexterity: 14, intelligence: 10, wisdom: 14, charisma: 8 } },
  bard: { hp: 8, stats: { strength: 8, constitution: 10, dexterity: 12, intelligence: 12, wisdom: 10, charisma: 16 } }
};

class RPGBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.activeCampaigns = new Map(); // channelId -> campaign
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    return this.enabled;
  }

  // Roll dice (e.g., "1d20+5", "2d6")
  rollDice(notation) {
    const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) return { total: 0, rolls: [] };

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    const rolls = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    return {
      rolls,
      modifier,
      total: total + modifier,
      notation,
      natural: total
    };
  }

  // Get stat modifier
  getModifier(stat) {
    return Math.floor((stat - 10) / 2);
  }

  // Create a new campaign
  async createCampaign(channelId, userId, options) {
    if (!this.enabled) {
      throw new Error('RPG Bot is not enabled');
    }

    // Check for existing active campaign
    const existing = await RPGCampaign.getActiveCampaign(channelId);
    if (existing) {
      throw new Error('There is already an active campaign in this channel');
    }

    const campaign = new RPGCampaign({
      name: options.name || 'Unnamed Adventure',
      description: options.description || '',
      channel: channelId,
      createdBy: userId,
      type: options.type || 'party',
      difficulty: options.difficulty || 'normal',
      setting: options.setting || 'fantasy',
      maxPlayers: options.maxPlayers || 4
    });

    await campaign.save();
    this.activeCampaigns.set(channelId.toString(), campaign);

    this.broadcast(channelId, 'rpg:campaign-created', {
      campaign: this.formatCampaign(campaign)
    });

    return campaign;
  }

  // Join a campaign with a new character
  async joinCampaign(channelId, userId, characterData) {
    const campaign = await this.getCampaign(channelId);

    if (campaign.status !== 'recruiting') {
      throw new Error('Campaign is not accepting new players');
    }

    if (campaign.characters.length >= campaign.maxPlayers) {
      throw new Error('Campaign is full');
    }

    if (campaign.getCharacter(userId)) {
      throw new Error('You already have a character in this campaign');
    }

    const classTemplate = classTemplates[characterData.class] || classTemplates.warrior;

    const character = {
      user: userId,
      name: characterData.name || 'Unnamed Hero',
      class: characterData.class || 'warrior',
      race: characterData.race || 'human',
      level: 1,
      experience: 0,
      stats: { ...classTemplate.stats },
      hp: { current: classTemplate.hp, max: classTemplate.hp },
      inventory: this.getStartingInventory(characterData.class),
      gold: 10,
      isAlive: true
    };

    campaign.characters.push(character);
    await campaign.save();

    this.broadcast(channelId, 'rpg:player-joined', {
      character: character.name,
      class: character.class,
      race: character.race
    });

    return character;
  }

  // Get starting inventory by class
  getStartingInventory(charClass) {
    const inventories = {
      warrior: [
        { name: 'Longsword', quantity: 1, type: 'weapon' },
        { name: 'Shield', quantity: 1, type: 'armor' },
        { name: 'Health Potion', quantity: 2, type: 'potion' }
      ],
      mage: [
        { name: 'Staff', quantity: 1, type: 'weapon' },
        { name: 'Spellbook', quantity: 1, type: 'misc' },
        { name: 'Mana Potion', quantity: 2, type: 'potion' }
      ],
      rogue: [
        { name: 'Dagger', quantity: 2, type: 'weapon' },
        { name: 'Lockpicks', quantity: 1, type: 'misc' },
        { name: 'Smoke Bomb', quantity: 2, type: 'misc' }
      ],
      cleric: [
        { name: 'Mace', quantity: 1, type: 'weapon' },
        { name: 'Holy Symbol', quantity: 1, type: 'misc' },
        { name: 'Health Potion', quantity: 3, type: 'potion' }
      ],
      ranger: [
        { name: 'Bow', quantity: 1, type: 'weapon' },
        { name: 'Arrows', quantity: 20, type: 'misc' },
        { name: 'Hunting Knife', quantity: 1, type: 'weapon' }
      ],
      bard: [
        { name: 'Rapier', quantity: 1, type: 'weapon' },
        { name: 'Lute', quantity: 1, type: 'misc' },
        { name: 'Charm Potion', quantity: 2, type: 'potion' }
      ]
    };
    return inventories[charClass] || inventories.warrior;
  }

  // Start the adventure
  async startAdventure(channelId) {
    const campaign = await this.getCampaign(channelId);

    if (campaign.characters.length === 0) {
      throw new Error('No players have joined the campaign');
    }

    if (campaign.status === 'active') {
      throw new Error('Adventure has already started');
    }

    campaign.status = 'active';
    campaign.totalSessions++;

    // Generate opening scene
    const template = adventureTemplates[campaign.setting] || adventureTemplates.fantasy;
    const opening = template.starts[Math.floor(Math.random() * template.starts.length)];

    campaign.currentScene = {
      title: 'The Beginning',
      description: opening,
      type: 'exploration',
      options: this.generateOptions(campaign)
    };

    campaign.addStoryEvent({
      type: 'narrative',
      text: opening
    });

    await campaign.save();

    this.broadcast(channelId, 'rpg:adventure-started', {
      scene: campaign.currentScene
    });

    return campaign;
  }

  // Generate options for current scene
  generateOptions(campaign) {
    const options = [];
    const setting = campaign.setting;

    if (campaign.currentScene?.type === 'combat') {
      options.push(
        { id: 'attack', text: 'Attack the enemy', requires: null },
        { id: 'defend', text: 'Take a defensive stance', requires: null },
        { id: 'flee', text: 'Attempt to flee', requires: { stat: 'dexterity', dc: 12 } }
      );
    } else {
      options.push(
        { id: 'explore', text: 'Explore the area', requires: { stat: 'wisdom', dc: 10 } },
        { id: 'search', text: 'Search for treasure', requires: { stat: 'intelligence', dc: 12 } },
        { id: 'continue', text: 'Continue forward', requires: null },
        { id: 'rest', text: 'Rest and recover', requires: null }
      );
    }

    return options;
  }

  // Player takes an action
  async takeAction(channelId, userId, actionId) {
    const campaign = await this.getCampaign(channelId);

    if (campaign.status !== 'active') {
      throw new Error('Campaign is not active');
    }

    const character = campaign.getCharacter(userId);
    if (!character) {
      throw new Error('You do not have a character in this campaign');
    }

    if (!character.isAlive) {
      throw new Error('Your character has fallen. You cannot take actions.');
    }

    const option = campaign.currentScene?.options?.find(o => o.id === actionId);
    if (!option) {
      throw new Error('Invalid action');
    }

    let success = true;
    let rollResult = null;

    // Check if action requires a skill check
    if (option.requires) {
      const stat = character.stats[option.requires.stat] || 10;
      const modifier = this.getModifier(stat);
      rollResult = this.rollDice('1d20');
      rollResult.modifier = modifier;
      rollResult.total = rollResult.natural + modifier;
      rollResult.dc = option.requires.dc;
      success = rollResult.total >= option.requires.dc;
    }

    // Process the action
    const result = await this.processAction(campaign, character, actionId, success, rollResult);

    await campaign.save();
    this.activeCampaigns.set(channelId.toString(), campaign);

    this.broadcast(channelId, 'rpg:action-result', {
      character: character.name,
      action: option.text,
      roll: rollResult,
      success,
      result,
      scene: campaign.currentScene,
      characterStatus: {
        hp: character.hp,
        level: character.level,
        experience: character.experience
      }
    });

    return result;
  }

  // Process action and update game state
  async processAction(campaign, character, actionId, success, roll) {
    const template = adventureTemplates[campaign.setting] || adventureTemplates.fantasy;
    let narrative = '';

    switch (actionId) {
      case 'attack':
        return this.processCombatAction(campaign, character, 'attack');

      case 'defend':
        return this.processCombatAction(campaign, character, 'defend');

      case 'flee':
        if (success) {
          narrative = `${character.name} successfully escapes from combat!`;
          campaign.currentScene = this.generateExplorationScene(campaign, template);
        } else {
          narrative = `${character.name} fails to escape! The enemy attacks!`;
          // Enemy gets a free attack
          await this.enemyAttack(campaign, character);
        }
        break;

      case 'explore':
        if (success) {
          // Random encounter or discovery
          if (Math.random() < 0.4) {
            narrative = this.generateCombatScene(campaign, template);
          } else {
            narrative = `${character.name} carefully explores the area and finds a safe path forward.`;
            campaign.currentScene = this.generateExplorationScene(campaign, template);
          }
        } else {
          narrative = `${character.name} stumbles into danger!`;
          this.generateCombatScene(campaign, template);
        }
        break;

      case 'search':
        if (success) {
          const treasure = template.treasures[Math.floor(Math.random() * template.treasures.length)];
          const goldFound = Math.floor(Math.random() * 20) + 5;
          character.gold += goldFound;
          campaign.treasureFound++;
          narrative = `${character.name} finds ${treasure} and ${goldFound} gold!`;

          if (treasure.includes('potion')) {
            character.inventory.push({ name: treasure, quantity: 1, type: 'potion' });
          }
        } else {
          narrative = `${character.name} searches but finds nothing of value.`;
        }
        campaign.currentScene.options = this.generateOptions(campaign);
        break;

      case 'continue':
        // Progress the story
        if (Math.random() < 0.5) {
          narrative = this.generateCombatScene(campaign, template);
        } else {
          narrative = 'The party continues their journey...';
          campaign.currentScene = this.generateExplorationScene(campaign, template);
        }
        break;

      case 'rest':
        const healAmount = Math.min(character.hp.max - character.hp.current, Math.floor(character.hp.max * 0.3));
        character.hp.current += healAmount;
        narrative = `${character.name} rests and recovers ${healAmount} HP.`;
        campaign.currentScene.options = this.generateOptions(campaign);
        break;

      default:
        narrative = 'Nothing happens...';
    }

    campaign.addStoryEvent({
      type: 'narrative',
      text: narrative,
      actor: character.user,
      actorName: character.name,
      rolls: roll ? [roll] : []
    });

    return { narrative };
  }

  // Generate combat scene
  generateCombatScene(campaign, template) {
    const enemy = { ...template.encounters[Math.floor(Math.random() * template.encounters.length)] };
    enemy.hp = { current: enemy.hp, max: enemy.hp };

    campaign.currentScene = {
      title: 'Combat!',
      description: `A ${enemy.name} appears and attacks!`,
      type: 'combat',
      options: this.generateOptions({ ...campaign, currentScene: { type: 'combat' } }),
      enemies: [enemy]
    };

    campaign.totalCombats++;
    return `A ${enemy.name} appears and attacks!`;
  }

  // Generate exploration scene
  generateExplorationScene(campaign, template) {
    const location = template.locations[Math.floor(Math.random() * template.locations.length)];
    const descriptions = [
      `You arrive at a mysterious ${location}.`,
      `The path leads you deeper into the ${location}.`,
      `Before you lies an ancient ${location}.`,
      `You discover a hidden entrance to a ${location}.`
    ];

    return {
      title: `The ${location.charAt(0).toUpperCase() + location.slice(1)}`,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      type: 'exploration',
      options: this.generateOptions(campaign),
      enemies: []
    };
  }

  // Process combat action
  async processCombatAction(campaign, character, action) {
    const enemy = campaign.currentScene.enemies?.[0];
    if (!enemy) {
      return { narrative: 'No enemy to fight!' };
    }

    let narrative = '';

    if (action === 'attack') {
      // Player attacks
      const attackRoll = this.rollDice('1d20');
      const strMod = this.getModifier(character.stats.strength);
      const hitTotal = attackRoll.natural + strMod;

      if (hitTotal >= enemy.defense) {
        const damageRoll = this.rollDice('1d8');
        const damage = Math.max(1, damageRoll.total + strMod);
        enemy.hp.current -= damage;

        if (enemy.hp.current <= 0) {
          // Enemy defeated
          narrative = `${character.name} strikes ${enemy.name} for ${damage} damage, defeating it!`;

          // Award XP
          const enemyTemplate = adventureTemplates[campaign.setting]?.encounters.find(e => e.name === enemy.name);
          const xp = enemyTemplate?.xp || 25;
          character.experience += xp;
          campaign.monstersSlain++;

          // Check for level up
          const levelUpXp = character.level * 100;
          if (character.experience >= levelUpXp) {
            character.level++;
            character.experience -= levelUpXp;
            character.hp.max += 5;
            character.hp.current = character.hp.max;
            narrative += ` ${character.name} levels up to level ${character.level}!`;

            campaign.addStoryEvent({
              type: 'levelup',
              text: `${character.name} reached level ${character.level}!`,
              actor: character.user,
              actorName: character.name
            });
          }

          // Return to exploration
          campaign.currentScene = this.generateExplorationScene(campaign, adventureTemplates[campaign.setting]);

        } else {
          narrative = `${character.name} hits ${enemy.name} for ${damage} damage! (${enemy.hp.current}/${enemy.hp.max} HP remaining)`;
          // Enemy counter-attacks
          await this.enemyAttack(campaign, character);
        }
      } else {
        narrative = `${character.name} misses!`;
        // Enemy attacks
        await this.enemyAttack(campaign, character);
      }
    } else if (action === 'defend') {
      // Defending reduces incoming damage
      narrative = `${character.name} takes a defensive stance.`;
      // Enemy attacks with reduced damage
      await this.enemyAttack(campaign, character, 0.5);
    }

    campaign.addStoryEvent({
      type: 'combat',
      text: narrative,
      actor: character.user,
      actorName: character.name
    });

    return { narrative };
  }

  // Enemy attacks
  async enemyAttack(campaign, character, damageMultiplier = 1) {
    const enemy = campaign.currentScene.enemies?.[0];
    if (!enemy || enemy.hp.current <= 0) return;

    const attackRoll = this.rollDice('1d20');
    const playerAC = 10 + this.getModifier(character.stats.dexterity);

    if (attackRoll.natural + enemy.attack >= playerAC) {
      const damageRoll = this.rollDice(enemy.damage);
      const damage = Math.max(1, Math.floor(damageRoll.total * damageMultiplier));
      character.hp.current -= damage;

      if (character.hp.current <= 0) {
        character.hp.current = 0;
        character.isAlive = false;

        campaign.addStoryEvent({
          type: 'death',
          text: `${character.name} has fallen in battle against ${enemy.name}!`,
          actor: character.user,
          actorName: character.name
        });
      }
    }
  }

  // Get campaign
  async getCampaign(channelId) {
    let campaign = this.activeCampaigns.get(channelId.toString());
    if (!campaign) {
      campaign = await RPGCampaign.getActiveCampaign(channelId);
      if (campaign) {
        this.activeCampaigns.set(channelId.toString(), campaign);
      }
    }
    if (!campaign) {
      throw new Error('No active campaign in this channel');
    }
    return campaign;
  }

  // Format campaign for client
  formatCampaign(campaign) {
    return {
      id: campaign._id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      type: campaign.type,
      difficulty: campaign.difficulty,
      setting: campaign.setting,
      players: campaign.characters.map(c => ({
        name: c.name,
        class: c.class,
        race: c.race,
        level: c.level,
        hp: c.hp,
        isAlive: c.isAlive
      })),
      maxPlayers: campaign.maxPlayers,
      currentScene: campaign.currentScene,
      stats: {
        totalSessions: campaign.totalSessions,
        totalCombats: campaign.totalCombats,
        monstersSlain: campaign.monstersSlain,
        treasureFound: campaign.treasureFound
      }
    };
  }

  // End campaign
  async endCampaign(channelId, userId) {
    const campaign = await this.getCampaign(channelId);

    if (campaign.createdBy.toString() !== userId.toString()) {
      throw new Error('Only the campaign creator can end the campaign');
    }

    campaign.status = 'completed';
    await campaign.save();

    this.activeCampaigns.delete(channelId.toString());

    this.broadcast(channelId, 'rpg:campaign-ended', {
      campaign: this.formatCampaign(campaign)
    });

    return campaign;
  }

  // Get campaign status
  async getStatus(channelId) {
    try {
      const campaign = await RPGCampaign.getActiveCampaign(channelId);
      return {
        enabled: this.enabled,
        hasCampaign: !!campaign,
        campaign: campaign ? this.formatCampaign(campaign) : null
      };
    } catch (error) {
      return {
        enabled: this.enabled,
        hasCampaign: false,
        campaign: null
      };
    }
  }

  // Broadcast to channel
  broadcast(channelId, event, data) {
    if (this.io) {
      this.io.to(`channel:${channelId}`).emit(event, data);
    }
  }
}

module.exports = RPGBotService;
