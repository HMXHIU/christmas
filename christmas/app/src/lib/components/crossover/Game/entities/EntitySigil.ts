import type { EntityStats } from "$lib/crossover/types";
import { Container, Graphics } from "pixi.js";
import type { EntityContainer } from ".";

export { EntitySigil };

const HALF_PI = Math.PI / 2;
const MND_ARC_END = HALF_PI * 3;
const CHA_ARC_END = -HALF_PI;

class EntitySigil extends Container {
    public entityContainer: EntityContainer;
    private arcsContainer: Container;

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
    private mndArc: Graphics | null = null;
    private chaArc: Graphics | null = null;

    private mndArcEnd: number = MND_ARC_END;
    private chaArcEnd: number = CHA_ARC_END;

    private radius = 0;

    constructor(
        entityContainer: EntityContainer,
        maxStats: EntityStats,
        stats: EntityStats,
        opts?: { anchor?: { x: number; y: number }; radius?: number },
    ) {
        super({});
        this.entityContainer = entityContainer;
        this.arcsContainer = new Container();
        this.stats = stats;
        this.maxStats = maxStats;

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

            this.mask = mask;
            this.addChild(mask);
            this.addChild(backdrop);
            this.addChild(this.arcsContainer);
            this.addChild(spriteContainer);
            this.createBars();
            this.updateStats(this.stats);
        }
    }

    createBars() {
        // Clear existing arcs
        this.arcsContainer.removeChildren();
        const bounds = this.getBounds();

        // Draw hp bar
        this.hpBar = new Graphics()
            .rect(0, 0, bounds.width, bounds.height)
            .fill({ color: 0xfd5353 });
        this.hpBar.x = -bounds.width / 2;
        this.hpBar.y = bounds.height / 2;
        this.hpBar.pivot.y = bounds.height;

        // Draw mp, st arcs
        this.chaArc = new Graphics()
            .arc(0, 0, this.radius + 2, HALF_PI, this.chaArcEnd, true)
            .stroke({ color: 0x53fd75, width: 6 });
        this.mndArc = new Graphics()
            .arc(0, 0, this.radius + 2, HALF_PI, this.mndArcEnd)
            .stroke({ color: 0x5394fd, width: 6 });

        // Add to container
        this.arcsContainer.addChild(this.hpBar, this.chaArc, this.mndArc);
    }

    updateStats(stats: EntityStats) {
        this.stats = stats;
        if (this.hpBar) {
            this.hpBar.scale.y = stats.hp / this.maxStats.hp;
        }
        if (this.mndArc) {
            const percent = stats.mnd / this.maxStats.mnd;
            this.mndArc
                .clear()
                .arc(
                    0,
                    0,
                    this.radius + 2,
                    HALF_PI,
                    HALF_PI + (MND_ARC_END - HALF_PI) * percent,
                )
                .stroke({ color: 0xf4fd53, width: 6 });
        }
        if (this.chaArc) {
            const percent = stats.cha / this.maxStats.cha;
            this.chaArc
                .clear()
                .arc(
                    0,
                    0,
                    this.radius + 2,
                    HALF_PI,
                    HALF_PI + (CHA_ARC_END - HALF_PI) * percent,
                    true,
                )
                .stroke({ color: 0x5394fd, width: 6 });
        }
    }
}
