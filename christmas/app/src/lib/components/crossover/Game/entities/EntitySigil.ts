import type { CurrencyParams, EntityStats } from "$lib/crossover/types";
import { entityLevel, entityStats } from "$lib/crossover/world/entity";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { skillLevelProgression } from "$lib/crossover/world/skills";
import { pick } from "lodash-es";
import { Container, Graphics, Text } from "pixi.js";
import type { EntityContainer } from ".";

export { EntitySigil };

const AVATAR_RADIUS = 36;
const AVATAR_DIAMETER = 2 * AVATAR_RADIUS;
const BAR_HEIGHT = AVATAR_RADIUS / 2 / 4;
const BAR_WIDTH = AVATAR_DIAMETER + AVATAR_RADIUS;

class EntitySigil extends Container {
    public entityContainer: EntityContainer;
    private barsContainer: Container;
    private maxResources: EntityStats & CurrencyParams = {
        hp: 0,
        mnd: 0,
        cha: 0,
        lum: 0,
        umb: 0,
    };
    private resources: EntityStats & CurrencyParams = {
        hp: 0,
        mnd: 0,
        cha: 0,
        lum: 0,
        umb: 0,
    };

    private hpBar: Graphics | null = null;
    private mndBar: Graphics | null = null;
    private chaBar: Graphics | null = null;
    private lumBar: Graphics | null = null;
    private umbBar: Graphics | null = null;

    constructor(entityContainer: EntityContainer) {
        super({});
        this.entityContainer = entityContainer;
        this.barsContainer = new Container();

        // Update resource & create bars
        this.updateResources();
        this.createBars();
        this.updateUI();
        this.addChild(this.barsContainer); // add resource bars to backdrop

        // Entity name
        const entityNameText = new Text({
            text: this.entityContainer.entity.name,
            style: {
                fill: 0xffffff,
                stroke: 0xffffff,
                fontSize: 18,
            },
        });
        entityNameText.x = AVATAR_DIAMETER;
        entityNameText.y = -BAR_HEIGHT * 2;
        this.addChild(entityNameText);

        // Get the avatar portrait as a sprite
        let avatarPortrait = entityContainer.asSpriteContainer();
        if (avatarPortrait) {
            const anchor = { x: 0, y: -0.825 };
            const bounds = avatarPortrait.getBounds();

            const mask = new Graphics()
                .circle(0, 0, AVATAR_RADIUS + 5)
                .fill({ color: 0xffffff });
            mask.x = AVATAR_RADIUS;

            avatarPortrait.pivot.x = anchor.x * bounds.width;
            avatarPortrait.pivot.y = anchor.y * bounds.height;
            avatarPortrait.mask = mask;
            avatarPortrait.x = AVATAR_RADIUS;

            this.addChild(mask);
            this.addChild(avatarPortrait);
        }
    }

    updateResources() {
        const entity = this.entityContainer.entity;
        // Creature
        if ("player" in entity || "monster" in entity) {
            this.resources = pick(entity, ["umb", "lum", "hp", "mnd", "cha"]);
            const maxCurrency = skillLevelProgression(entityLevel(entity));
            this.maxResources = {
                ...entityStats(entity),
                umb: maxCurrency,
                lum: maxCurrency,
            };
        }
        // Item
        else {
            this.maxResources = {
                hp: compendium[entity.prop].durability,
                mnd: 0,
                cha: 0,
                lum: 0,
                umb: 0,
            };
            this.resources = {
                hp: entity.dur,
                mnd: 0,
                cha: 0,
                lum: 0,
                umb: 0,
            };
        }
    }

    createBars() {
        // Clear existing arcs
        this.barsContainer.removeChildren();

        // Draw hp bar
        this.hpBar = new Graphics()
            .rect(0, 0, BAR_WIDTH, BAR_HEIGHT)
            .fill({ color: 0xfd5353 });
        this.hpBar.x = AVATAR_DIAMETER;
        this.hpBar.y = AVATAR_RADIUS - BAR_HEIGHT * 5;
        this.hpBar.pivot.x = 0;

        // Draw chaos bar
        this.chaBar = new Graphics()
            .rect(0, 0, BAR_WIDTH, BAR_HEIGHT)
            .fill({ color: 0x53fd75 });
        this.chaBar.x = AVATAR_DIAMETER;
        this.chaBar.y = AVATAR_RADIUS - BAR_HEIGHT * 4;
        this.chaBar.pivot.x = 0;

        // Draw mind bar
        this.mndBar = new Graphics()
            .rect(0, 0, BAR_WIDTH, BAR_HEIGHT)
            .fill({ color: 0x5394fd });
        this.mndBar.x = AVATAR_DIAMETER;
        this.mndBar.y = AVATAR_RADIUS - BAR_HEIGHT * 3;
        this.mndBar.pivot.x = 0;

        // Draw lumina bar
        this.lumBar = new Graphics()
            .rect(0, 0, BAR_WIDTH, BAR_HEIGHT)
            .fill({ color: 0xfdf653 });
        this.lumBar.x = AVATAR_DIAMETER;
        this.lumBar.y = AVATAR_RADIUS - BAR_HEIGHT * 2;
        this.lumBar.pivot.x = 0;

        // Draw umbra bar
        this.umbBar = new Graphics()
            .rect(0, 0, BAR_WIDTH, BAR_HEIGHT)
            .fill({ color: 0x7553fd });
        this.umbBar.x = AVATAR_DIAMETER;
        this.umbBar.y = AVATAR_RADIUS - BAR_HEIGHT;
        this.umbBar.pivot.x = 0;

        // Add to container
        this.barsContainer.addChild(
            this.hpBar,
            this.chaBar,
            this.mndBar,
            this.lumBar,
            this.umbBar,
        );
    }

    updateUI() {
        this.updateResources();
        if (this.hpBar) {
            this.hpBar.scale.x =
                Math.min(this.maxResources.hp, this.resources.hp) /
                this.maxResources.hp;
        }
        if (this.chaBar) {
            this.chaBar.scale.x =
                Math.min(this.maxResources.cha, this.resources.cha) /
                this.maxResources.cha;
        }
        if (this.mndBar) {
            this.mndBar.scale.x =
                Math.min(this.maxResources.mnd, this.resources.mnd) /
                this.maxResources.mnd;
        }
        if (this.lumBar) {
            this.lumBar.scale.x =
                Math.min(this.maxResources.lum, this.resources.lum) /
                this.maxResources.lum;
        }
        if (this.umbBar) {
            this.umbBar.scale.x =
                Math.min(this.maxResources.umb, this.resources.umb) /
                this.maxResources.umb;
        }
    }
}
