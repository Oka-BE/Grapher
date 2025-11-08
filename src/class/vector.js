
export class Vector2 {
    x
    y
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }
    sub(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }
    mul(s) {
        return new Vector2(this.x * s, this.y * s);
    }
    div(s) {
        return new Vector2(this.x / s, this.y / s);
    }
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    length() {
        return Math.hypot(this.x, this.y);
    }
    normalize() {
        const len = this.length();
        return len === 0 ? new Vector2(0, 0) : this.div(len);
    }
    angle() {
        return Math.atan2(this.y, this.x);
    }
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
    }
    distanceTo(v) {
        return this.sub(v).length();
    }
    clone() {
        return new Vector2(this.x, this.y);
    }
    toString() {
        return `Vector2(${this.x}, ${this.y})`;
    }
}