export { playerStats };

function playerStats({ level }: { level: number }): {
    hp: number;
    mp: number;
    st: number;
    ap: number;
} {
    return {
        hp: level * 10,
        mp: level * 10,
        st: level * 10,
        ap: level * 10,
    };
}
