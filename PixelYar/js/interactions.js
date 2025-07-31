// interactions.js - Random game interactions and events with water objects
import { CONFIG } from './config.js';

export class InteractionManager {
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.interactions = [
      // Enhanced interactions with inventory integration
      { text: 'Rough waves! Hull takes 5 damage!', action: (player) => { player.hull = Math.max(0, player.hull - 5); } },
      { text: 'It\'s a clear day to sail! Take one more move, matey!', action: (player) => { return { extraMove: true }; } },
      { text: 'A storm sweeps a crew member overboard! -1 crew!', action: (player) => { player.crew = Math.max(0, player.crew - 1); } },
      { text: 'Ye find a floating barrel of rum! Crew morale rises. +2 crew!', action: (player) => { player.crew += 2; }, waterObject: 'floating_barrel' },
      { text: 'A sneaky kraken nicks yer hull! -10 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 10); }, waterObject: 'kraken_tentacle' },
      { text: 'A rival pirate fires a warning shot! -3 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 3); } },
      { text: 'A mutiny brews! Lose 2 crew!', action: (player) => { player.crew = Math.max(0, player.crew - 2); } },
      { text: 'A friendly merchant gifts ye supplies. +3 hull!', action: (player) => { player.hull += 3; } },
      { text: 'Ye rescue a stranded sailor. +1 crew!', action: (player) => { player.crew += 1; } },
      { text: 'A cannon misfires! -2 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 2); } },
      { text: 'A sea monster attacks! -4 hull, -1 crew!', action: (player) => { player.hull = Math.max(0, player.hull - 4); player.crew = Math.max(0, player.crew - 1); } },
      { text: 'A parrot squawks a warning—ye dodge danger! Nothing happens.', action: () => { } },
      { text: 'A mysterious fog—ye lose yer bearings. No effect.', action: () => { } },
      { text: 'A sea witch curses yer hull! -6 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 6); } },
      { text: 'A pod of whales guides ye to safety. +2 hull!', action: (player) => { player.hull += 2; } },
      { text: 'A cannonball narrowly misses! No effect.', action: () => { } },
      { text: 'A lucky wind fills yer sails! Take another move!', action: () => { return { extraMove: true }; } },
      { text: 'A shark bites yer hull! -8 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 8); } },
      { text: 'A crew member falls ill. -1 crew!', action: (player) => { player.crew = Math.max(0, player.crew - 1); } },
      { text: 'A cannon explodes! -3 hull, -1 crew!', action: (player) => { player.hull = Math.max(0, player.hull - 3); player.crew = Math.max(0, player.crew - 1); } },
      { text: 'A rival pirate challenges ye—lose 2 crew!', action: (player) => { player.crew = Math.max(0, player.crew - 2); } },
      { text: 'A sudden calm—nothing happens.', action: () => { } },
      { text: 'A mermaid blesses yer voyage! +2 hull!', action: (player) => { player.hull += 2; }, waterObject: 'siren_rock' },
      { text: 'A pirate legend inspires yer crew! +3 crew!', action: (player) => { player.crew += 3; } },

      // New inventory-focused interactions
      { text: 'A merchant ship offers to trade supplies!', action: () => { }, waterObject: 'merchant_ship' },
      { text: 'Ye discover a shipwreck with salvageable materials!', action: (player) => { player.hull = Math.max(0, player.hull - 2); }, waterObject: 'shipwreck' },
      { text: 'A fishing boat shares their catch with ye!', action: (player) => { player.crew += 1; }, waterObject: 'fishing_boat' },
      { text: 'Pirates attack from the shadows! Defend yerself!', action: (player) => { player.hull = Math.max(0, player.hull - 8); player.crew = Math.max(0, player.crew - 1); } },
      { text: 'A friendly dolphin guides ye to calmer waters. +1 hull!', action: (player) => { player.hull += 1; } },
      { text: 'Ye spot a treasure island in the distance!', action: () => { }, waterObject: 'treasure_island' },
      { text: 'A storm damages yer sails but ye find driftwood. Hull -3!', action: (player) => { player.hull = Math.max(0, player.hull - 3); } },
      { text: 'Ye encounter a ghost ship that phases through yer vessel!', action: () => { }, waterObject: 'ghost_ship' },
      { text: 'A sea turtle brings good luck! Nothing bad happens.', action: () => { } },
      { text: 'Ye find an abandoned raft with supplies floating nearby!', action: (player) => { player.hull += 2; }, waterObject: 'abandoned_raft' },
      { text: 'A whirlpool threatens yer ship! -5 hull from the turbulence!', action: (player) => { player.hull = Math.max(0, player.hull - 5); }, waterObject: 'whirlpool' },
      { text: 'Ye rescue a castaway who knows valuable trade routes!', action: (player) => { player.crew += 1; } },
      { text: 'A rival captain challenges ye to a drinking contest!', action: (player) => { player.crew = Math.max(0, player.crew - 1); } },
      { text: 'Ye find a message in a bottle with a treasure map!', action: () => { }, waterObject: 'message_bottle' },
      { text: 'A school of flying fish damages yer rigging! -2 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 2); } },
      { text: 'Ye discover an underwater cave with ancient treasures!', action: (player) => { player.hull += 1; }, waterObject: 'underwater_cave' },
      { text: 'A lighthouse keeper warns ye of dangerous rocks ahead!', action: () => { }, waterObject: 'lighthouse' },
      { text: 'Ye encounter a naval patrol - they inspect yer ship!', action: (player) => { player.crew = Math.max(0, player.crew - 1); } },
      { text: 'A friendly sea captain shares navigation tips!', action: (player) => { player.hull += 2; } },
      { text: 'Ye find a floating chest, but it\'s trapped! -4 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 4); }, waterObject: 'trapped_chest' },

      // 50 NEW INTERACTIONS WITH WATER OBJECTS
      { text: 'A shipwreck blocks yer path! Navigate around it. +1 booty from salvage!', action: (player) => { player.booty += 1; }, waterObject: 'wreckage' },
      { text: 'Ye sail into a whirlpool! -3 hull from the spinning waters!', action: (player) => { player.hull = Math.max(0, player.hull - 3); }, waterObject: 'whirlpool' },
      { text: 'A sea mine explodes nearby! -12 hull damage!', action: (player) => { player.hull = Math.max(0, player.hull - 12); }, waterObject: 'sea_mine' },
      { text: 'Ye find a floating corpse with a purse! +2 booty, but bad luck ahead!', action: (player) => { player.booty += 2; }, waterObject: 'floating_corpse' },
      { text: 'Merchant cargo floats by! Salvage it for +3 booty!', action: (player) => { player.booty += 3; }, waterObject: 'merchant_cargo' },
      { text: 'A cursed idol surfaces! -2 crew flee in terror, +4 booty!', action: (player) => { player.crew = Math.max(0, player.crew - 2); player.booty += 4; }, waterObject: 'cursed_idol' },
      { text: 'Sirens sing from a rocky outcrop! -1 crew mesmerized!', action: (player) => { player.crew = Math.max(0, player.crew - 1); }, waterObject: 'siren_rock' },
      { text: 'A kraken tentacle surfaces! Dodge quickly! -5 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 5); }, waterObject: 'kraken_tentacle' },
      { text: 'Volcanic rock floats past! Hot steam damages hull! -4 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 4); }, waterObject: 'volcanic_rock' },
      { text: 'An ice floe drifts by! Fresh water for the crew! +1 crew!', action: (player) => { player.crew += 1; }, waterObject: 'ice_floe' },
      { text: 'A pirate flag floats in the water! Bad omen! -1 booty!', action: (player) => { player.booty = Math.max(0, player.booty - 1); }, waterObject: 'pirate_flag' },
      { text: 'Ye discover a sunken treasure vault! +8 booty!', action: (player) => { player.booty += 8; }, waterObject: 'treasure_chest' },
      { text: 'A phantom galleon passes through yer ship! Crew terrified! -2 crew!', action: (player) => { player.crew = Math.max(0, player.crew - 2); }, waterObject: 'ghost_ship' },
      { text: 'Ye find a message in a bottle with treasure coordinates! +5 booty!', action: (player) => { player.booty += 5; }, waterObject: 'message_bottle' },
      { text: 'A barrel of gunpowder floats by! Dangerous but valuable! +3 booty!', action: (player) => { player.booty += 3; }, waterObject: 'floating_barrel' },
      { text: 'Ancient wreckage reveals a skeleton crew! They join ye! +3 crew!', action: (player) => { player.crew += 3; }, waterObject: 'wreckage' },
      { text: 'A maelstrom threatens to pull ye under! Fight the current! -6 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 6); }, waterObject: 'whirlpool' },
      { text: 'Ye trigger an old naval mine! Massive explosion! -15 hull!', action: (player) => { player.hull = Math.max(0, player.hull - 15); }, waterObject: 'sea_mine' },
      { text: 'A dead pirate captain floats by with his treasure map! +6 booty!', action: (player) => { player.booty += 6; }, waterObject: 'floating_corpse' },
      { text: 'Spilled merchant spices create a fragrant trail! +2 booty from trade!', action: (player) => { player.booty += 2; }, waterObject: 'merchant_cargo' },
      { text: 'The cursed idol whispers dark secrets! Gain forbidden knowledge! +1 crew!', action: (player) => { player.crew += 1; }, waterObject: 'cursed_idol' },
      { text: 'Siren song lures yer ship toward jagged rocks! -4 hull damage!', action: (player) => { player.hull = Math.max(0, player.hull - 4); }, waterObject: 'siren_rock' },
      { text: 'A massive kraken tentacle slams yer deck! -8 hull, -1 crew!', action: (player) => { player.hull = Math.max(0, player.hull - 8); player.crew = Math.max(0, player.crew - 1); }, waterObject: 'kraken_tentacle' },
      { text: 'Molten volcanic rock hisses as it hits the water! Steam cloud! No effect!', action: () => { }, waterObject: 'volcanic_rock' },
      { text: 'Ye break through an ice floe! Cold but refreshing! +2 hull!', action: (player) => { player.hull += 2; }, waterObject: 'ice_floe' },
      { text: 'A rival pirate\'s flag marks their territory! Trespass at yer peril! No effect!', action: () => { }, waterObject: 'pirate_flag' },
      { text: 'A locked treasure chest requires yer best lockpick! +7 booty!', action: (player) => { player.booty += 7; }, waterObject: 'treasure_chest' },
      { text: 'The ghost ship\'s crew beckons ye to join them! Resist! -1 crew!', action: (player) => { player.crew = Math.max(0, player.crew - 1); }, waterObject: 'ghost_ship' },
      { text: 'The bottle contains a love letter and a gold ring! +2 booty!', action: (player) => { player.booty += 2; }, waterObject: 'message_bottle' },
      { text: 'A barrel of aged rum! The finest ye\'ve ever tasted! +3 crew!', action: (player) => { player.crew += 3; }, waterObject: 'floating_barrel' },
      { text: 'Ye salvage cannons from the wreckage! Upgrade yer firepower! +1 crew!', action: (player) => { player.crew += 1; }, waterObject: 'wreckage' },
      { text: 'The whirlpool spits out ancient coins! +4 booty!', action: (player) => { player.booty += 4; }, waterObject: 'whirlpool' },
      { text: 'A defused sea mine contains valuable metal! +3 booty!', action: (player) => { player.booty += 3; }, waterObject: 'sea_mine' },
      { text: 'The corpse wears a captain\'s coat with hidden pockets! +3 booty!', action: (player) => { player.booty += 3; }, waterObject: 'floating_corpse' },
      { text: 'Exotic merchant goods float in waterproof containers! +4 booty!', action: (player) => { player.booty += 4; }, waterObject: 'merchant_cargo' },
      { text: 'The cursed idol grants dark powers but demands sacrifice! -3 hull, +5 booty!', action: (player) => { player.hull = Math.max(0, player.hull - 3); player.booty += 5; }, waterObject: 'cursed_idol' },
      { text: 'Ye resist the siren\'s call and sail past safely! +1 crew (impressed)!', action: (player) => { player.crew += 1; }, waterObject: 'siren_rock' },
      { text: 'A baby kraken tentacle! Ye capture it for the ship\'s menagerie! +2 crew!', action: (player) => { player.crew += 2; }, waterObject: 'kraken_tentacle' },
      { text: 'Volcanic glass from the rock makes excellent arrowheads! +2 booty!', action: (player) => { player.booty += 2; }, waterObject: 'volcanic_rock' },
      { text: 'Ye harvest fresh ice for the ship\'s stores! +3 hull (preservation)!', action: (player) => { player.hull += 3; }, waterObject: 'ice_floe' },
      { text: 'The pirate flag belongs to a legendary captain! Inspiration! +2 crew!', action: (player) => { player.crew += 2; }, waterObject: 'pirate_flag' },
      { text: 'A mimic treasure chest! It bites! -2 hull but +6 booty inside!', action: (player) => { player.hull = Math.max(0, player.hull - 2); player.booty += 6; }, waterObject: 'treasure_chest' },
      { text: 'The ghost ship offers to trade spectral crew! +4 crew (ghostly)!', action: (player) => { player.crew += 4; }, waterObject: 'ghost_ship' },
      { text: 'A bottle with a genie! Three wishes! Choose wisely! +3 booty!', action: (player) => { player.booty += 3; }, waterObject: 'message_bottle' },
      { text: 'A barrel of black powder! Handle with care! +5 booty (dangerous)!', action: (player) => { player.booty += 5; }, waterObject: 'floating_barrel' },
      { text: 'The wreckage contains a ship\'s bell! Good luck charm! +1 hull!', action: (player) => { player.hull += 1; }, waterObject: 'wreckage' },
      { text: 'Ye navigate the whirlpool\'s edge perfectly! Skillful sailing! Extra move!', action: () => { return { extraMove: true }; }, waterObject: 'whirlpool' },
      { text: 'A sea mine\'s chain tangles yer rudder! -2 hull, lose next turn!', action: (player) => { player.hull = Math.max(0, player.hull - 2); }, waterObject: 'sea_mine' },
      { text: 'The floating corpse is actually sleeping! He joins yer crew! +1 crew!', action: (player) => { player.crew += 1; }, waterObject: 'floating_corpse' },
      { text: 'Merchant cargo contains rare maps of secret routes! +4 booty!', action: (player) => { player.booty += 4; }, waterObject: 'merchant_cargo' },
      { text: 'The cursed idol crumbles to dust, breaking its curse! +2 hull!', action: (player) => { player.hull += 2; }, waterObject: 'cursed_idol' },
      { text: 'Ye throw gold to the sirens as tribute! They let ye pass! -2 booty!', action: (player) => { player.booty = Math.max(0, player.booty - 2); }, waterObject: 'siren_rock' }
    ];
  }

  triggerRandomInteraction(player, playerX, playerY, inventory) {
    // Don't do the random check here - it's already done in the game loop
    const interaction = this.interactions[Math.floor(Math.random() * this.interactions.length)];
    const result = interaction.action(player, inventory) || {};

    // Add water object if specified
    if (interaction.waterObject && this.worldManager) {
      // Place object near player (within 5 pixels)
      const offsetX = Math.floor(Math.random() * 11) - 5; // -5 to +5
      const offsetY = Math.floor(Math.random() * 11) - 5;
      const objX = Math.max(0, Math.min(CONFIG.OCEAN_WIDTH - 1, playerX + offsetX));
      const objY = Math.max(0, Math.min(CONFIG.OCEAN_HEIGHT - 1, playerY + offsetY));

      // Don't place on islands or existing objects
      if (this.worldManager.isValidPosition(objX, objY) && !this.worldManager.getWaterObjectAt(objX, objY)) {
        this.worldManager.addWaterObject(objX, objY, interaction.waterObject, {
          fromInteraction: true,
          interactionText: interaction.text
        });
      }
    }

    return {
      text: interaction.text,
      extraMove: result.extraMove || false
    };
  }

  // Add more interactions dynamically
  addInteraction(text, actionFn, waterObjectType = null) {
    this.interactions.push({ text, action: actionFn, waterObject: waterObjectType });
  }

  getInteractionCount() {
    return this.interactions.length;
  }

  getRandomInteraction() {
    return this.interactions[Math.floor(Math.random() * this.interactions.length)];
  }
}