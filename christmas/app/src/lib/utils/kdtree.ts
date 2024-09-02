export { KdTree };

type Point = number[];

class KdTreeNode<T> {
    constructor(
        public point: Point,
        public data: T,
        public left: KdTreeNode<T> | null = null,
        public right: KdTreeNode<T> | null = null,
    ) {}
}

class KdTree<T> {
    private root: KdTreeNode<T> | null = null;
    private dimensions: number;

    constructor(dimensions: number) {
        this.dimensions = dimensions;
    }

    insert(point: Point, data: T): void {
        if (point.length !== this.dimensions) {
            throw new Error(`Point must have ${this.dimensions} dimensions`);
        }
        this.root = this.insertNode(this.root, point, data, 0);
    }

    private insertNode(
        node: KdTreeNode<T> | null,
        point: Point,
        data: T,
        depth: number,
    ): KdTreeNode<T> {
        if (node === null) {
            return new KdTreeNode(point, data);
        }

        const axis = depth % this.dimensions;
        if (point[axis] < node.point[axis]) {
            node.left = this.insertNode(node.left, point, data, depth + 1);
        } else {
            node.right = this.insertNode(node.right, point, data, depth + 1);
        }

        return node;
    }

    findNearest(targetPoint: Point): { point: Point; data: T } | null {
        if (targetPoint.length !== this.dimensions) {
            throw new Error(
                `Target point must have ${this.dimensions} dimensions`,
            );
        }

        if (this.root === null) return null;

        let bestNode = this.root;
        let bestDistance = this.distance(targetPoint, this.root.point);

        const searchNearest = (
            node: KdTreeNode<T> | null,
            depth: number,
        ): void => {
            if (node === null) return;

            const distance = this.distance(targetPoint, node.point);
            if (distance < bestDistance) {
                bestNode = node;
                bestDistance = distance;
            }

            const axis = depth % this.dimensions;
            const diff = targetPoint[axis] - node.point[axis];

            const nextBranch = diff < 0 ? node.left : node.right;
            const otherBranch = diff < 0 ? node.right : node.left;

            searchNearest(nextBranch, depth + 1);

            if (Math.abs(diff) < bestDistance) {
                searchNearest(otherBranch, depth + 1);
            }
        };

        searchNearest(this.root, 0);

        return { point: bestNode.point, data: bestNode.data };
    }

    private distance(point1: Point, point2: Point): number {
        return Math.sqrt(
            point1.reduce((sum, value, index) => {
                const diff = value - point2[index];
                return sum + diff * diff;
            }, 0),
        );
    }
}
