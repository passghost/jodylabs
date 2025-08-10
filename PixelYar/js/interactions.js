// interactions.js - Random game interactions and events with water objects
import { CONFIG } from './config.js';

export class InteractionManager {
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.interactions = [
      // TREASURE & DISCOVERY INTERACTIONS
      { 
        text: 'Ye discover a sunken Spanish galleon! Ancient gold coins spill from its broken hull!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 3); 
          return { inventoryReward: { item: 'Gold Coins', quantity: 25 } }; 
        }, 
        waterObject: 'shipwreck' 
      },
      { 
        text: 'A mysterious floating chest bobs in the waves! Inside ye find exotic spices from distant lands!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Spices', quantity: 4 } }; 
        }, 
        waterObject: 'treasure_chest' 
      },
      { 
        text: 'Ye net a massive pearl from an oyster bed! The crew cheers at yer fortune!', 
        action: (player, inventory) => { 
          player.crew += 1; 
          return { inventoryReward: { item: 'Pearls', quantity: 3 } }; 
        } 
      },
      { 
        text: 'A merchant vessel\'s cargo floats nearby! Ye salvage fine silk and trading goods!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Silk', quantity: 2 } }; 
        }, 
        waterObject: 'merchant_cargo' 
      },
      { 
        text: 'An old pirate\'s treasure map floats in a bottle! X marks the spot for future adventures!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Treasure Maps', quantity: 1 } }; 
        }, 
        waterObject: 'message_bottle' 
      },

      // SUPPLY & CRAFTING INTERACTIONS
      { 
        text: 'Ye find a floating barrel of the finest Caribbean rum! The crew\'s spirits soar!', 
        action: (player, inventory) => { 
          player.crew += 2; 
          return { inventoryReward: { item: 'Rum Bottles', quantity: 5 } }; 
        }, 
        waterObject: 'floating_barrel' 
      },      { 
 
       text: 'A shipwright\'s supplies drift past! Wooden planks and rope - perfect for repairs!', 
        action: (player, inventory) => { 
          player.hull += 5; 
          return { inventoryReward: { item: 'Wooden Planks', quantity: 8 } }; 
        } 
      },
      { 
        text: 'Ye discover a naval supply cache! Gunpowder and cannon balls for yer arsenal!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Cannon Balls', quantity: 15 } }; 
        } 
      },
      { 
        text: 'A ship\'s doctor\'s bag washes ashore on a small island! Medicine for the crew!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Medicine', quantity: 3 } }; 
        } 
      },
      { 
        text: 'Ye salvage rope and rigging from a wrecked vessel! Essential supplies for any pirate!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Rope', quantity: 6 } }; 
        } 
      },

      // MAGICAL & MYSTICAL INTERACTIONS
      { 
        text: 'A sea witch emerges from the depths! She curses yer hull but gifts ye a lucky charm!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 8); 
          return { inventoryReward: { item: 'Lucky Charm', quantity: 1 } }; 
        }, 
        waterObject: 'siren_rock' 
      },
      { 
        text: 'Ye encounter a mystical kraken! It damages yer ship but drops enchanted pearls!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 12); 
          return { inventoryReward: { item: 'Pearls', quantity: 5 } }; 
        }, 
        waterObject: 'kraken_tentacle' 
      },
      { 
        text: 'A ghostly pirate captain appears! He challenges ye to a duel, then vanishes, leaving treasure!', 
        action: (player, inventory) => { 
          player.crew = Math.max(0, player.crew - 1); 
          return { inventoryReward: { item: 'Gold Coins', quantity: 20 } }; 
        }, 
        waterObject: 'ghost_ship' 
      },
      { 
        text: 'Mermaids sing an enchanting song! They heal yer wounds and gift ye ocean treasures!', 
        action: (player, inventory) => { 
          player.hull += 8; 
          return { inventoryReward: { item: 'Pearls', quantity: 2 } }; 
        } 
      },

      // COMBAT & DANGER INTERACTIONS
      { 
        text: 'Rival pirates ambush ye from behind a fog bank! Ye fight them off but take damage!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 10); 
          player.crew = Math.max(0, player.crew - 1); 
          return { inventoryReward: { item: 'Gold Coins', quantity: 8 } }; 
        } 
      },     
 { 
        text: 'A naval patrol spots ye! Ye outrun them but yer cannon overheats and misfires!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 6); 
          return { inventoryReward: { item: 'Gunpowder', quantity: 2 } }; 
        } 
      },
      { 
        text: 'Sea monsters attack from the depths! Ye fend them off with cannon fire!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 8); 
          return { inventoryReward: { item: 'Medicine', quantity: 2 } }; 
        } 
      },
      { 
        text: 'A massive storm batters yer ship! Lightning strikes but ye salvage metal from the mast!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 7); 
          return { inventoryReward: { item: 'Rope', quantity: 4 } }; 
        } 
      },

      // CREW & SOCIAL INTERACTIONS
      { 
        text: 'Ye rescue a skilled navigator from a sinking vessel! He joins yer crew with his instruments!', 
        action: (player, inventory) => { 
          player.crew += 2; 
          return { inventoryReward: { item: 'Spyglass', quantity: 1 } }; 
        } 
      },
      { 
        text: 'A famous pirate legend shares tales with yer crew! They\'re inspired and work harder!', 
        action: (player, inventory) => { 
          player.crew += 3; 
          player.hull += 5; 
          return { inventoryReward: { item: 'Rum Bottles', quantity: 3 } }; 
        } 
      },
      { 
        text: 'Ye encounter a friendly merchant who trades exotic goods for yer protection!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Spices', quantity: 3 } }; 
        }, 
        waterObject: 'merchant_cargo' 
      },
      { 
        text: 'A castaway with knowledge of secret trade routes joins yer crew!', 
        action: (player, inventory) => { 
          player.crew += 1; 
          return { inventoryReward: { item: 'Treasure Maps', quantity: 2 } }; 
        } 
      },

      // EXPLORATION & ADVENTURE INTERACTIONS
      { 
        text: 'Ye discover an uncharted island with rare resources! Time to stock up on supplies!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Wooden Planks', quantity: 6 } }; 
        }, 
        waterObject: 'treasure_island' 
      }, 
     { 
        text: 'A pod of dolphins leads ye to a hidden cove filled with ancient artifacts!', 
        action: (player, inventory) => { 
          player.hull += 3; 
          return { inventoryReward: { item: 'Gold Coins', quantity: 15 } }; 
        } 
      },
      { 
        text: 'Ye find a derelict pirate ship with its cargo intact! Rum, gold, and supplies!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Rum Bottles', quantity: 4 } }; 
        }, 
        waterObject: 'abandoned_raft' 
      },
      { 
        text: 'An underwater cave reveals itself at low tide! Inside, ye find pirate treasure!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Pearls', quantity: 4 } }; 
        }, 
        waterObject: 'underwater_cave' 
      },

      // PIXEL PACK INTERACTIONS
      { 
        text: 'A mysterious artist\'s supplies float by! Colorful paints for marking yer territory!', 
        action: (player, inventory) => { 
          const colors = ['Red Pixel Pack', 'Blue Pixel Pack', 'Green Pixel Pack', 'Yellow Pixel Pack', 'Purple Pixel Pack'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          return { inventoryReward: { item: randomColor, quantity: 3 } }; 
        } 
      },
      { 
        text: 'Ye discover a cartographer\'s lost supplies! Perfect for marking important locations!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Blue Pixel Pack', quantity: 5 } }; 
        } 
      },

      // POSITIVE FORTUNE INTERACTIONS
      { 
        text: 'The wind gods favor ye today! Yer sails fill with perfect breeze!', 
        action: (player, inventory) => { 
          return { extraMove: true }; 
        } 
      },
      { 
        text: 'A school of flying fish brings good luck! They guide ye to calmer waters!', 
        action: (player, inventory) => { 
          player.hull += 4; 
          return { extraMove: true }; 
        } 
      },
      { 
        text: 'Ye spot a rainbow after a storm! Legend says it leads to treasure!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Gold Coins', quantity: 12 } }; 
        } 
      },

      // NEUTRAL/ATMOSPHERIC INTERACTIONS
      { 
        text: 'A wise old sea turtle surfaces near yer ship. It nods knowingly before diving deep.', 
        action: (player, inventory) => { 
          player.hull += 2; 
        } 
      },    
  { 
        text: 'Ye sail through a patch of bioluminescent plankton! The sea glows like stars!', 
        action: (player, inventory) => { 
          // Pure atmosphere - small hull bonus for the beautiful sight
          player.hull += 1; 
        } 
      },
      { 
        text: 'A majestic whale breaches nearby, spraying yer ship with refreshing seawater!', 
        action: (player, inventory) => { 
          player.hull += 3; 
          player.crew += 1; 
        } 
      },
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
      { text: 'Spilled merchant spices create a fragrant trail! +2 booty from trade!', action: (player) => { player.booty += 2; }, waterObject: 'merchant_cargo' },      { 
text: 'The cursed idol whispers dark secrets! Gain forbidden knowledge! +1 crew!', action: (player) => { player.crew += 1; }, waterObject: 'cursed_idol' },
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
      { text: 'Ye throw gold to the sirens as tribute! They let ye pass! -2 booty!', action: (player) => { player.booty = Math.max(0, player.booty - 2); }, waterObject: 'siren_rock' },

      // NEW SPECIAL EVENT TYPES
      { 
        text: '🦈 BUTT SHARK IS TRYING TO SHOW YEE THE WAY! The legendary guide appears with ancient charts!', 
        action: (player, inventory) => { 
          return { inventoryReward: { item: 'Treasure Maps', quantity: 5 } }; 
        },
        waterObject: 'butt_shark'
      },
      { 
        text: '🌟 A shooting star crashes into the ocean! Stardust and cosmic treasures float to the surface!', 
        action: (player, inventory) => { 
          player.hull += 10;
          return { inventoryReward: { item: 'Gold Coins', quantity: 30 } }; 
        },
        waterObject: 'meteor_crash'
      },
      { 
        text: '🐙 The Ancient Kraken awakens from its slumber! It tests yer courage with riddles and rewards!', 
        action: (player, inventory) => { 
          player.crew = Math.max(0, player.crew - 2);
          return { inventoryReward: { item: 'Pearls', quantity: 8 } }; 
        },
        waterObject: 'ancient_kraken'
      },
      { 
        text: '👻 A ghostly pirate fleet emerges from the mist! They challenge ye to a spectral duel!', 
        action: (player, inventory) => { 
          player.hull = Math.max(0, player.hull - 15);
          return { inventoryReward: { item: 'Lucky Charm', quantity: 2 } }; 
        },
        waterObject: 'ghost_fleet'
      },
      { 
        text: '🏝️ A mysterious island rises from the depths! Ancient ruins hold forgotten treasures!', 
        action: (player, inventory) => { 
          return { 
            inventoryReward: { item: 'Treasure Maps', quantity: 3 },
            treasureLocation: true
          }; 
        },
        waterObject: 'mysterious_island'
      }
    ];
  }
riggerRandomInteraction(player, playerX, playerY, inventory) {
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