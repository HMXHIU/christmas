import type { EntityStats } from "$lib/crossover/types";
import { Container, Graphics } from "pixi.js";
import type { EntityContainer } from ".";

export { EntitySigil };

const HALF_PI = Math.PI / 2;
const MND_ARC_END = HALF_PI * 3;
const CHA_ARC_END = -HALF_PI;

const BAR_HEIGHT = 4;

class EntitySigil extends Container {
    public entityContainer: EntityContainer;
    private barsContainer: Container;
    private maxStats: EntityStats = {
        hp: 0,
        mnd: 0,
        cha: 0,
    };
    private stats: EntityStats = {
        hp: 0,
        mnd: 0,
        cha: 0,
    };

    private hpBar: Graphics | null = null;
    private mndBar: Graphics | null = null;
    private chaBar: Graphics | null = null;

    // Currency umbra dn lumina has no max (approximated)
    private lumBar: Graphics | null = null;
    private umbBar: Graphics | null = null;

    private radius = 0;

    constructor(
        entityContainer: EntityContainer,
        maxStats: EntityStats,
        stats: EntityStats,
        opts?: { anchor?: { x: number; y: number }; radius?: number },
    ) {
        super({});
        this.entityContainer = entityContainer;
        this.barsContainer = new Container();
        this.stats = stats;
        this.maxStats = maxStats;

        // TODO: draw name on sigil, get umb, lum, stats etc ... remove passing in max stats, stats
        const entity = entityContainer.entity;
        if ("player" in entity) {
        }

        let spriteContainer = entityContainer.asSpriteContainer();

        if (spriteContainer) {
            const bounds = spriteContainer.getBounds();
            this.radius = opts?.radius ?? bounds.width / 2;

            // Create mask
            const mask = new Graphics()
                .circle(0, 0, this.radius + 5)
                .fill({ color: 0xffffff });

            // Create backdrop
            const backdrop = new Graphics()
                .circle(0, 0, this.radius)
                .fill({ color: 0x000000 });

            // Set spriteContainer pivot
            spriteContainer.pivot.x = (opts?.anchor?.x ?? 0) * bounds.width;
            spriteContainer.pivot.y = (opts?.anchor?.y ?? 0) * bounds.height;

            // this.mask = mask;
            // this.addChild(mask);
            this.addChild(backdrop);
            this.addChild(this.barsContainer);
            // this.addChild(spriteContainer);
            this.createBars();
            this.updateStats(this.stats);
        }
    }

    createBars() {
        // Clear existing arcs
        this.barsContainer.removeChildren();
        const bounds = this.getBounds();
        console.log(bounds);

        // Draw hp bar
        this.hpBar = new Graphics()
            .rect(0, 0, bounds.width, BAR_HEIGHT)
            .fill({ color: 0xfd5353 });
        this.hpBar.x = -bounds.width / 2;
        this.hpBar.y = bounds.height / 2 - BAR_HEIGHT * 4;
        this.hpBar.pivot.x = 0;

        // Draw chaos bar
        this.chaBar = new Graphics()
            .rect(0, 0, bounds.width, BAR_HEIGHT)
            .fill({ color: 0x53fd75 });
        this.chaBar.x = -bounds.width / 2;
        this.chaBar.y = bounds.height / 2 - BAR_HEIGHT * 3;
        this.chaBar.pivot.x = 0;

        // Draw mind bar
        this.mndBar = new Graphics()
            .rect(0, 0, bounds.width, BAR_HEIGHT)
            .fill({ color: 0x5394fd });
        this.mndBar.x = -bounds.width / 2;
        this.mndBar.y = bounds.height / 2 - BAR_HEIGHT * 2;
        this.mndBar.pivot.x = 0;

        // Draw lumina bar
        this.lumBar = new Graphics()
            .rect(0, 0, bounds.width, BAR_HEIGHT)
            .fill({ color: 0x5394fd });
        this.lumBar.x = -bounds.width / 2;
        this.lumBar.y = bounds.height / 2 - BAR_HEIGHT;
        this.lumBar.pivot.x = 0;

        // Draw umbra bar
        this.umbBar = new Graphics()
            .rect(0, 0, bounds.width, BAR_HEIGHT)
            .fill({ color: 0x5394fd });
        this.umbBar.x = -bounds.width / 2;
        this.umbBar.y = bounds.height / 2;
        this.umbBar.pivot.x = 0;

        // Add to container
        this.barsContainer.addChild(this.hpBar, this.chaBar, this.mndBar);
    }

    updateStats(stats: EntityStats) {
        this.stats = stats;
        if (this.hpBar) {
            this.hpBar.scale.x = stats.hp / this.maxStats.hp;
        }
        if (this.chaBar) {
            this.chaBar.scale.x = stats.cha / this.maxStats.cha;
        }
        if (this.mndBar) {
            this.mndBar.scale.x = stats.mnd / this.maxStats.mnd;
        }
    }
}
