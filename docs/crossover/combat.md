# Combat

Based on die rolls, there are the following types of rolls

**_Attack Roll_**

Determines if the attack/spell hits or miss based on the folllowing

- 1d20 default roll
- `dex`/`str`/`int`/`fth`/`cha` (depending on the weapon and spell)
- Target's DC (`dex` for physical attacks, `int` or `fth` or `cha` depending on the spell)

**_Damage Roll_**

Determines how much damage is dealt based on the following

- Weapon roll (eg. 1d6, 2d6, 1d12)
- `dex`/`str`/`int`/`fth`/`cha` (depending on the weapon and spell)
- Damage Reduction (DR) based on armor that is hit

**_Body Part Roll_**

Determines which body part is targeted

- This is only for physical attacks
- Determines which armour is used for Damage Reduction (DR)
- Armour that is hit loses durability

Effects of hitting different body parts

- A hit on the head is a critical hit
- A hit on the legs reduces mobility
- A hit on the arm causes weakness

## Equipment

Equipment can add Armour Class (AC) and Damage Reduction (DR)

- AC and DR should be precalculated and stored in `PlayerEntity` during `equip` and `unequip`

## Actions

For actions there is a default `attack` command. Hook the main combat resolver into the `attack` command.

**_attack_**

- Default `attack [target] with [weapon]` or `attack [target]` (unarmed)
- Reduces weapon `durability` if attack roll is successful

## Utilities

Some items and weapons have utilities imbued (performs an ability)

- Each use consumes a `charge` on the item
- Performs the ability imbued
- Hooks into the same die roll combat system if its a spell or physical ability

## Abilities

Abilites can be spells, physical attacks, buffs, debuffs

- [ ] Hook the combat system into the perform effects of the ability
- [ ] Each effect needs to have its own die rolls (attack, damage, body part)

## Buffs and Debuffs

When an entity gets a buff or debuff, make an entry in redis with the expiry time (it should be in turns). Every turn a process should read the DB and expire any buffs or debuffs and publish the event to the entities.

## Opportunity Attacks

TODO: Implement in the future (not easy as need to hook into movement)

If the target is within melee range and moves away, if the player is wielding a melee weapon or unarmed he should get a free attack
