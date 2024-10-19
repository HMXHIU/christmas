export { aesthetics, beings, ethics, hostility, morals, type Affinity };

interface Affinity {
    moral: Moral;
    ethic: Ethic;
    aesthetic: Aesthetic;
    being: Being;
}

type Moral = "good" | "evil" | "neutral";
type Ethic = "chaotic" | "lawful" | "balanced";
type Aesthetic = "elegant" | "grotesque" | "mundane";
type Being = "cosmic" | "fae" | "mortal";

interface Alignment {
    description: string;
    axis: number; // used to calculate the difference in alignment between 2 entities
}

const morals: Record<Moral, Alignment> = {
    good: {
        description:
            "You seek to help others, promote justice, and are altruistic.",
        axis: 1,
    },
    neutral: {
        description:
            "You are indifferent to moral questions or balance good and evil.",
        axis: 0,
    },
    evil: {
        description:
            "You are selfish, cruel, or willing to harm others for personal gain.",
        axis: -1,
    },
};

const ethics: Record<Ethic, Alignment> = {
    lawful: {
        description: "You believe in order, rules, and structure.",
        axis: 1,
    },
    balanced: {
        description:
            "You act according to circumstance or balance order and chaos.",
        axis: 0,
    },
    chaotic: {
        description:
            "You value freedom, individuality, and disruption of rules or structure.",
        axis: -1,
    },
};

const aesthetics: Record<Aesthetic, Alignment> = {
    elegant: {
        description:
            "Your kind is known for its beauty, harmony, and refined forms. Your culture values grace, symmetry, and perfection.",
        axis: 0.5,
    },
    mundane: {
        description:
            "Your kind exhibits a pragmatic approach to aesthetics. Your culture favors practicality and functionality over appearance.",
        axis: 0,
    },
    grotesque: {
        description:
            "Your kind embraces the bizarre and distorted. Your culture embraces the grotesque, the ugly and the abominable.",
        axis: -0.5,
    },
};

const beings: Record<Being, Alignment> = {
    cosmic: {
        description:
            "Your otherworldly nature is that of the transcendent and the abstract, beyond mortal comprehension.",
        axis: 1,
    },
    fae: {
        description:
            "You are a magical being existing on the fringe of reality.",
        axis: 0.5,
    },
    mortal: {
        description: "You are a mortal grounded in the physical world.",
        axis: 0,
    },
};

function hostility(a: Affinity, b: Affinity): number {
    return (
        Math.abs(morals[a.moral].axis - morals[b.moral].axis) +
        Math.abs(ethics[a.ethic].axis - ethics[b.ethic].axis) +
        Math.abs(aesthetics[a.aesthetic].axis - aesthetics[b.aesthetic].axis) +
        Math.abs(beings[a.being].axis - beings[b.being].axis)
    );
}
