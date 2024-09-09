import { recoverAp } from "$lib/crossover/world/entity";
import { MS_PER_TICK, TICKS_PER_TURN } from "$lib/crossover/world/settings";
import type {
    EntityStats,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { Container, Graphics } from "pixi.js";
import type { EntityContainer } from ".";

export { EntitySigil };

const HALF_PI = Math.PI / 2;
const ST_ARC_END = HALF_PI * 3;
const MP_ARC_END = -HALF_PI;

class EntitySigil extends Container {
    public entityContainer: EntityContainer;
    private arcsContainer: Container;

    private maxStats: EntityStats = {
        ap: 0,
        hp: 0,
        st: 0,
        mp: 0,
        apclk: 0,
    };
    private stats: EntityStats = {
        ap: 0,
        hp: 0,
        st: 0,
        mp: 0,
        apclk: 0,
    };

    private hpBar: Graphics | null = null;
    private apBar: Graphics | null = null;
    private stArc: Graphics | null = null;
    private mpArc: Graphics | null = null;

    private stArcEnd: number = ST_ARC_END;
    private mpArcEnd: number = MP_ARC_END;

    private radius = 0;
    private apInterval;

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

            // Set up interval every tick to recover ap
            this.apInterval = setInterval(
                this.recoverAp,
                MS_PER_TICK * TICKS_PER_TURN,
            );
        }
    }

    recoverAp() {
        if (this.apBar) {
            this.apBar.scale.y =
                recoverAp(
                    (this.entityContainer.entity as Player | Monster).ap,
                    this.maxStats.ap,
                    (this.entityContainer.entity as Player | Monster).apclk,
                    Date.now(),
                ) / this.maxStats.ap;
        }
    }

    destroy() {
        if (this.apInterval) {
            clearInterval(this.apInterval);
            this.apInterval = undefined;
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
        this.mpArc = new Graphics()
            .arc(0, 0, this.radius + 2, HALF_PI, this.mpArcEnd, true)
            .stroke({ color: 0x5394fd, width: 6 });
        this.stArc = new Graphics()
            .arc(0, 0, this.radius + 2, HALF_PI, this.stArcEnd)
            .stroke({ color: 0xf4fd53, width: 6 });

        // Draw ap bar
        this.apBar = new Graphics()
            .rect(0, -4, bounds.width, bounds.height)
            .fill({ color: 0x111111, alpha: 0.25 });
        this.apBar.x = -bounds.width / 2;
        this.apBar.y = bounds.height / 2;
        this.apBar.pivot.y = bounds.height;

        // Add to container
        this.arcsContainer.addChild(
            this.hpBar,
            this.mpArc,
            this.stArc,
            this.apBar,
        );
    }

    updateStats(stats: EntityStats) {
        this.stats = stats;
        if (this.hpBar) {
            this.hpBar.scale.y = stats.hp / this.maxStats.hp;
        }
        if (this.apBar) {
            if (stats.apclk) {
                this.apBar.scale.y =
                    recoverAp(
                        stats.ap,
                        this.maxStats.ap,
                        stats.apclk,
                        Date.now(),
                    ) / this.maxStats.ap;
            } else {
                this.apBar.scale.y = this.stats.ap / this.maxStats.ap;
            }
        }
        if (this.stArc) {
            const percent = stats.st / this.maxStats.st;
            this.stArc
                .clear()
                .arc(
                    0,
                    0,
                    this.radius + 2,
                    HALF_PI,
                    HALF_PI + (ST_ARC_END - HALF_PI) * percent,
                )
                .stroke({ color: 0xf4fd53, width: 6 });
        }
        if (this.mpArc) {
            const percent = stats.mp / this.maxStats.mp;
            this.mpArc
                .clear()
                .arc(
                    0,
                    0,
                    this.radius + 2,
                    HALF_PI,
                    HALF_PI + (MP_ARC_END - HALF_PI) * percent,
                    true,
                )
                .stroke({ color: 0x5394fd, width: 6 });
        }
    }
}
