
export class FlatComputation {
    static OP = {
        PUSH_CONST: 0,
        PUSH_VAR: 1,
        ADD: 2,
        SUB: 3,
        MUL: 4,
        DIV: 5,
        POW: 6,
        FUNC: 7,
    }
    instructions
    constructor(expr) {
        this.instructions = expr.compile()
    }
    compute(list) {
        const stack = []
        for (let i = 0; i < this.instructions.length; i++) {
            const [op, operand] = this.instructions[i]
            switch (op) {
                case FlatComputation.OP.PUSH_CONST: {
                    stack.push(operand)
                    break
                }
                case FlatComputation.OP.PUSH_VAR: {
                    const v = list[operand]
                    stack.push(typeof v === 'number' ? v : NaN)
                    break
                }
                case FlatComputation.OP.ADD: {
                    const [b, a] = [stack.pop(), stack.pop()]
                    stack.push(a + b)
                    break
                }
                case FlatComputation.OP.SUB: {
                    const [b, a] = [stack.pop(), stack.pop()]
                    stack.push(a - b)
                    break
                }
                case FlatComputation.OP.MUL: {
                    const [b, a] = [stack.pop(), stack.pop()]
                    stack.push(a * b)
                    break
                }
                case FlatComputation.OP.DIV: {
                    const [b, a] = [stack.pop(), stack.pop()]
                    stack.push(a / b)
                    break
                }
                case FlatComputation.OP.POW: {
                    const [b, a] = [stack.pop(), stack.pop()]
                    stack.push(a ** b)
                    break
                }
                case FlatComputation.OP.FUNC: {
                    const argCount = operand.length
                    const args = Array(argCount)
                    for (let i = 0; i < argCount; i++) {
                        args[argCount - 1 - i] = stack.pop()
                    }
                    stack.push(operand(...args))
                }
            }
        }
        return stack.pop()
    }
}

export class Equation {
    static parse(latex) {
        const equalIndex = latex.indexOf('=')
        const lhs = Expression.parse(latex.slice(0, equalIndex))
        const rhs = Expression.parse(latex.slice(equalIndex + 1))
        if (lhs === null || rhs === null) {
            return null
        }
        return new Equation(lhs, rhs)
    }
    lhs = null
    rhs = null
    formed = false
    allVarsCache = null
    constructor(v, v2) {
        if (typeof v === 'string' && v2 === undefined) {
            const res = Equation.parse(v)
            if (res) {
                this.lhs = res.lhs
                this.rhs = res.rhs
            }
            return
        } else if (v instanceof Expression && v2 === undefined) {
            this.lhs = v
            this.rhs = new Expression([new Item([new Constant(0)])])
            return
        } else if (v instanceof Expression && v2 instanceof Expression) {
            this.lhs = v
            this.rhs = v2
            return
        }
        throw Error('wrong args for Equation\'s constructor')
    }
    latex() {
        try {
            return `${this.lhs.latex()}=${this.rhs.latex()}`
        } catch {
            return null
        }
    }
    /**
     * 获取所有Variable，包括隐式的
     * @returns Variable[]
     */
    allVars() {
        if (this.allVarsCache === null) {
            this.allVarsCache = [...this.lhs.allVars(), ...this.rhs.allVars()].reduce((acc, c) => {
                if (acc.find(v => v.name === c.name) === undefined) {
                    acc.push(c)
                }
                return acc
            }, [])
        }
        return this.allVarsCache
    }
    form() {
        if (this.formed) return
        this.lhs = new Expression(this.lhs.items.concat(this.rhs.items.map(item => {
            item.positive = !item.positive
            return item
        })))
        this.rhs.items = [new Item([new Constant(0)])]
        this.formed = true
    }
    clone() {
        return new Equation(this.lhs.clone(), this.rhs.clone())
    }
    /**
     * 隐式地把值代入变量，在计算的时候会把变量识别为Constant
     * 但是类型仍为Variable
     * @param {*} list 
     */
    hiddenSubstitute(list) {
        this.lhs.hiddenSubstitute(list)
        this.rhs.hiddenSubstitute(list)
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        this.lhs.substitute(list)
        this.rhs.substitute(list)
    }
    /**
     * 单个变量下寻找近似根
     * @param {number} granularity 采样寻找的颗粒度
     * @returns 所有根的数组（从小到大）
     */
    findRoots(min, max, granularity = 0.1, maxGap = 0.0001) {
        this.form()
        const vars = this.allVars().filter(v => v.v === null)
        if (vars.length !== 1) {
            console.log('size error', vars)
            return null
        }
        const varName = vars[0].name
        const roots = []
        // equ.lhs.findBreakPoints(min, max, granularity, maxGap * 0.1)
        let y = this.lhs.compute({ [varName]: min })
        let sign
        if (typeof y !== 'number' || isNaN(y)) {
            sign = null
        } else if (y === 0) {
            roots.push(min)
            sign = 0
        } else {
            sign = y < 0 ? -1 : 1
        }
        for (let v = min; v <= max; v += granularity) {
            const y = this.lhs.compute({ [varName]: v })
            if (typeof y !== 'number' || isNaN(y)) {
                sign = null
                continue
            }
            if (sign !== null) {
                if (sign * y === 0) {
                    if (y === 0) {
                        roots.push(v)
                        // console.log('found root in 0 posibility:', v)
                    }
                    sign = y < 0 ? -1 : y > 0 ? 1 : 0
                } else if (sign * y < 0) {
                    let left = v - granularity, right = v
                    const oLeftValue = this.lhs.compute({ [varName]: left })
                    const oRightValue = y
                    let leftValue = oLeftValue, rightValue = oRightValue
                    const rising = y > 0
                    while (right - left >= maxGap) {
                        const mid = (left + right) / 2
                        const y = this.lhs.compute({ [varName]: mid })
                        if (y === 0) {
                            left = right = mid
                            leftValue = rightValue = y
                            break
                        } else if (y < 0) {
                            if (rising) {
                                left = mid
                                leftValue = y
                            }
                            else {
                                right = mid
                                rightValue = y
                            }
                        } else {
                            if (rising) {
                                right = mid
                                rightValue = y
                            }
                            else {
                                left = mid
                                leftValue = y
                            }
                        }
                    }
                    if (Math.abs(leftValue - rightValue) < Math.abs(oLeftValue - oRightValue)) {
                        // if (!equ.lhs.hasBreakpointIn(left, right)) {
                        roots.push((left + right) / 2)
                    }
                }
            }
            sign = y < 0 ? -1 : y > 0 ? 1 : 0
        }
        return roots
    }
}

export class Expression {
    static parse(arg) {
        // return parseExpression(latex)
        let tokens
        if (Array.isArray(arg)) {
            tokens = arg
        } else {
            tokens = Tokenizer.tokenize(arg)
        }
        if (tokens === null || tokens.length === 0) {
            return null
        }
        tokens.push({ type: 'OP', value: '+' })
        const items = []
        let braceCount = 0
        let lastSplit = 0
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].value === '{' || tokens[i].value === '(') {
                braceCount++
            } else if (tokens[i].value === '}' || tokens[i].value === ')') {
                braceCount--
            }
            if ((tokens[i].value === '+' || tokens[i].value === '-') && braceCount === 0 && i > 0) {
                const item = Item.parse(tokens.slice(lastSplit, i))
                if (item === null) {
                    return null
                }
                items.push(item)
                lastSplit = i
            }
        }
        return new Expression(items)
    }

    items = []
    // breakPoints = []
    instruction = null
    constructor(v) {
        if (Array.isArray(v)) {
            this.items = v
        } else if (typeof v === 'string') {
            const expr = Expression.parse(v)
            if (expr) {
                this.items = expr.items
            }
        }
    }
    latex() {
        let latex = ''
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].positive && i > 0) latex += '+'
            latex += this.items[i].latex()
        }
        return latex
    }
    compute(list) {
        let res = 0
        for (let i = 0; i < this.items.length; i++) {
            res += this.items[i].compute(list)
        }
        return res
    }
    /**
     * 获取所有Variable，包括隐式的
     * @returns Variable[]
     */
    allVars() {
        return this.items.reduce((acc, c) => {
            const vars = c.allVars()
            for (let i = 0; i < vars.length; i++) {
                if (acc.find(v => v.name === vars[i].name) === undefined) {
                    acc.push(vars[i])
                }
            }
            return acc
        }, [])
    }
    clone() {
        return new Expression(this.items.map(item => item.clone()))
    }
    hiddenSubstitute(list) {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].hiddenSubstitute(list)
        }
        this.instruction = null
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].substitute(list)
        }
    }
    // hasBreakpointIn(min, max) {
    //     return this.findBreakPoints(min, max).length > 0
    //     // for (let i = 0; i < this.items.length; i++) {
    //     //     if (this.items[i].hasBreakpointIn(min, max)) {
    //     //         return true
    //     //     }
    //     // }
    //     // return false
    // }
    // findBreakPoints(min, max, granularity = (max - min) * 0.01, maxGap = granularity * 0.0001) {
    //     const interval = this.breakPoints.find(bp => bp.min <= min && bp.max >= max)
    //     if (interval === undefined) {
    //         const points = [...this.items.reduce((acc, c) => new Set([...acc, ...c.findBreakPoints(min, max, granularity, maxGap)]), new Set())]
    //         this.breakPoints.push({
    //             min, max,
    //             points
    //         })
    //         const last = this.breakPoints[this.breakPoints.length - 1]
    //         for (let i = 0; i < this.breakPoints.length - 1; i++) {
    //             if (this.breakPoints[i].min >= min && this.breakPoints[i].max <= max) {
    //                 this.breakPoints[i] = null
    //             } else if (this.breakPoints[i].min <= min && this.breakPoints[i].max >= min) {
    //                 last.points = [...new Set([...this.breakPoints[i].points, ...last.points])]
    //                 last.min = this.breakPoints[i].min
    //             } else if (this.breakPoints[i].min <= max && this.breakPoints[i].max >= max) {
    //                 last.points = [...new Set([...this.breakPoints[i].points, ...last.points])]
    //                 last.max = this.breakPoints[i].max
    //             }
    //         }
    //         this.breakPoints = this.breakPoints.filter(bp => bp !== null)
    //         return points
    //     }
    //     return interval.points.filter(p => p >= min && p <= max)
    // }
    flatCompute(list) {
        if (this.instruction === null) {
            this.instruction = new FlatComputation(this)
        }
        return this.instruction.compute(list)
    }
    /**
     * 返回一个FlatComputation的instructions数组
     */
    compile(instructions = []) {
        this.items[0].compile(instructions)
        for (let i = 1; i < this.items.length; i++) {
            this.items[i].compile(instructions)
            instructions.push([this.items[i].positive ? FlatComputation.OP.ADD : FlatComputation.OP.SUB])
        }
        return instructions
    }
}

export class Item {
    static parse(tokens) {
        if (tokens.length === 0) {
            return null
        }
        const parser = [
            Fraction.parse,
            Exponent.parse,
            Ln.parse,
            Lg.parse,
            Log.parse,
            Sin.parse,
            Arcsin.parse,
            Cos.parse,
            Arccos.parse,
            Tan.parse,
            Arctan.parse,
            Csc.parse,
            Arccsc.parse,
            Sec.parse,
            Arcsec.parse,
            Cot.parse,
            Arccot.parse,
            Variable.parse,
            Constant.parse,
        ]
        const positive = tokens[0].value !== '-'
        let i = tokens[0].value === '-' || tokens[0].value === '+' ? 1 : 0
        const part = []
        while (i < tokens.length) {
            let found = false
            for (let j = tokens.length; j > i; j--) {
                const subtokens = tokens.slice(i, j)
                for (let k = 0; k < parser.length; k++) {
                    const res = parser[k](subtokens)
                    if (res !== null) {
                        part.push(res)
                        found = true
                        i = j
                        break
                    }
                }
                if (found) {
                    break
                }
            }
            if (!found) {
                return null
            }
        }
        if (part.length === 0 || i < tokens.length) {
            return null
        }
        return new Item(part, positive)
    }

    positive = true
    part = []
    constructor(part = [], positive = true) {
        this.part = part
        this.positive = positive
    }
    latex() {
        return (this.positive ? '' : '-') + this.part.map((p, i) => (p instanceof Constant && typeof p.v === 'number' && i > 0 && this.part[i - 1] instanceof Constant && typeof this.part[i - 1].v === 'number' ? '\\cdot' : '') + p.latex()).join('')
    }
    compute(list) {
        let res = this.positive ? 1 : -1
        for (let i = 0; i < this.part.length; i++) {
            res *= this.part[i].compute(list)
        }
        return res
    }
    allVars() {
        return this.part.reduce((acc, c) => {
            const vars = c.allVars()
            for (let i = 0; i < vars.length; i++) {
                if (acc.find(v => v.name === vars[i].name) === undefined) {
                    acc.push(vars[i])
                }
            }
            return acc
        }, [])
    }
    clone() {
        return new Item(this.part.map(p => p.clone()), this.positive)
    }
    hiddenSubstitute(list) {
        for (let i = 0; i < this.part.length; i++) {
            if (this.part[i].hiddenSubstitute) {
                this.part[i].hiddenSubstitute(list)
            }
        }
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        for (let i = 0; i < this.part.length; i++) {
            let v
            if (this.part[i] instanceof Variable && (v = list[this.part[i].name]) !== undefined) {
                if (typeof v === 'number') {
                    this.part[i] = new Constant(v)
                } else {
                    this.part[i] = v
                }
            } else if (this.part[i].substitute) {
                this.part[i].substitute(list)
            }
        }
    }
    // hasBreakpointIn(min, max) {
    //     // console.log('Item check')
    //     for (let i = 0; i < this.part.length; i++) {
    //         if (this.part[i].hasBreakpointIn !== undefined && this.part[i].hasBreakpointIn(min, max)) {
    //             return true
    //         }
    //     }
    //     return false
    // }
    // findBreakPoints(min, max, granularity = (max - min) * 0.01, maxGap = granularity * 0.0001) {
    //     return [...this.part.reduce((acc, c) => new Set([...acc, ...(c.findBreakPoints ? c.findBreakPoints(min, max, granularity, maxGap) : [])]), new Set())]
    // }
    compile(instructions) {
        this.part[0].compile(instructions)
        for (let i = 1; i < this.part.length; i++) {
            this.part[i].compile(instructions)
            instructions.push([FlatComputation.OP.MUL])
        }
    }
}

export class Fraction {
    static parse(tokens) {
        if (tokens.length === 0 || tokens[0].value !== '\\frac') {
            return null
        }
        let braceCount = 0
        for (let i = 1; i < tokens.length; i++) {
            if (tokens[i].value === '{') {
                braceCount++
            } else if (tokens[i].value === '}') {
                braceCount--
                if (braceCount === 0) {
                    const numeratorTokens = tokens.slice(2, i)
                    const denominatorTokens = tokens.slice(i + 2, tokens.length - 1)
                    const parsedNumerator = Expression.parse(numeratorTokens)
                    const parsedDenominator = Expression.parse(denominatorTokens)
                    if (!parsedNumerator || !parsedDenominator) {
                        return null
                    }
                    return new Fraction(parsedNumerator, parsedDenominator)
                }
            }
        }
    }

    numerator = null
    denominator = null
    constructor(numerator = 1, denominator = 1) {
        this.numerator = numerator
        this.denominator = denominator
    }
    latex() {
        return `\\frac{${this.numerator.latex()}}{${this.denominator.latex()}}`
    }
    compute(list) {
        return this.numerator.compute(list) / this.denominator.compute(list)
    }
    /**
     * 获取所有Variable，包括隐式的
     * @returns Variable[]
     */
    allVars() {
        return [...this.numerator.allVars(), ...this.denominator.allVars()].reduce((acc, c) => {
            if (acc.find(v => v.name === c.name) === undefined) {
                acc.push(c)
            }
            return acc
        }, [])
    }
    clone() {
        return new Fraction(this.numerator.clone(), this.denominator.clone())
    }
    hiddenSubstitute(list) {
        this.numerator.hiddenSubstitute(list)
        this.denominator.hiddenSubstitute(list)
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        this.numerator.substitute(list)
        this.denominator.substitute(list)
    }
    // hasBreakpointIn(min, max) {
    //     // console.log('Frac check')
    //     // console.log(JSON.stringify((new Equation(this.denominator)).findRoots(min, max, (max - min) * 0.01, (max - min) * 0.0001), null, 2))
    //     // new Equation(this.denominator)
    //     // return false
    //     return this.denominator.allVars().filter(v => v.v === null).length > 0 && (new Equation(this.denominator.clone())).findRoots(min, max, (max - min) * 0.01, (max - min) * 0.0001).length > 0
    // }
    // findBreakPoints(min, max, granularity = (max - min) * 0.01, maxGap = granularity * 0.0001) {
    //     const roots = (new Equation(this.denominator.clone())).findRoots(min, max, granularity, maxGap)
    //     return roots !== null ? roots : []
    // }
    compile(instructions) {
        this.numerator.compile(instructions)
        this.denominator.compile(instructions)
        instructions.push([FlatComputation.OP.DIV])
    }
}

export class Exponent {
    static parse(tokens) {
        let braceCount = 0
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].value === '{' || tokens[i].value === '(') {
                braceCount++
            } else if (tokens[i].value === '}' || tokens[i].value === ')') {
                braceCount--
            }
            if (tokens[i].value === '^' && i < tokens.length - 1 && braceCount === 0) {
                const baseTokens = tokens.slice(0, i)
                const exponentTokens =
                    tokens[i + 1].value === '{' && tokens[tokens.length - 1].value === '}' ?
                        tokens.slice(i + 2, tokens.length - 1) :
                        tokens.slice(i + 1)
                const parsedBase = Expression.parse(baseTokens)
                const parsedExponent = Expression.parse(exponentTokens)
                if (!parsedBase || !parsedExponent) {
                    return null
                }
                return new Exponent(parsedBase, parsedExponent)
            }
        }
        return null
    }

    base
    exponent
    constructor(base, exponent) {
        this.base = base
        this.exponent = exponent
    }
    latex() {
        return `${this.base.latex()}^{${this.exponent.latex()}}`
    }
    compute(list) {
        return this.base.compute(list) ** this.exponent.compute(list)
    }
    allVars() {
        return [...this.base.allVars(), ...this.exponent.allVars()].reduce((acc, c) => {
            if (acc.find(v => v.name === c.name) === undefined) {
                acc.push(c)
            }
            return acc
        }, [])
    }
    clone() {
        return new Exponent(this.base.clone(), this.exponent.clone())
    }
    hiddenSubstitute(list) {
        this.base.hiddenSubstitute(list)
        this.exponent.hiddenSubstitute(list)
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        this.base.substitute(list)
        this.exponent.substitute(list)
    }
    // hasBreakpointIn(min, max) {
    //     return this.base.hasBreakpointIn(min, max) || this.exponent.hasBreakpointIn(min, max)
    // }
    compile(instructions) {
        this.base.compile(instructions)
        this.exponent.compile(instructions)
        instructions.push([FlatComputation.OP.POW])
    }
}

export class Root {

}

export class Function {
    name
    args
    constructor(name, args = []) {
        this.name = name
        this.args = args
    }
}

export class SimpleFunc {
    v
    constructor(v) {
        this.v = v
    }
    allVars() {
        return this.v.allVars()
    }
    hiddenSubstitute(list) {
        this.v.hiddenSubstitute(list)
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        this.v.substitute(list)
    }
    // hasBreakpointIn(min, max) {
    //     return this.v.hasBreakpointIn(min, max)
    // }
    compile(instructions) {
        this.v.compile(instructions)
        instructions.push([FlatComputation.OP.FUNC, this.f()])
    }
}

export class Bracket extends SimpleFunc {
    latex() {
        return `\\left(${this.v.latex()}\\right)`
    }
    compute(list) {
        return this.v.compute(list)
    }
    clone() {
        return new Bracket(this.v.clone())
    }
    f() {
        return v => v
    }
}

export class Ln extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\ln') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Ln(parsedArg)
    }

    latex() {
        return `\\ln${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.log(this.v.compute(list))
    }
    clone() {
        return new Ln(this.v.clone())
    }
    f() {
        return v => Math.log(v)
    }
}

export class Lg extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\lg') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Lg(parsedArg)
    }

    latex() {
        return `\\lg${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.log10(this.v.compute(list))
    }
    clone() {
        return new Lg(this.v.clone())
    }
    f() {
        return v => Math.log10(v)
    }
}

export class Log {
    static parse(tokens) {
        if (tokens.length < 3 || tokens[0].value !== '\\log_') {
            return null
        }
        let baseTokens
        let antilogTokens
        if (tokens[1].value !== '{') {
            baseTokens = [tokens[1]]
            antilogTokens = tokens.slice(2)
        } else {
            let braceCount = 1
            for (let i = 2; i < tokens.length; i++) {
                if (tokens[i].value === '{') {
                    braceCount++
                }
                else if (tokens[i].value === '}') {
                    braceCount--
                    if (braceCount === 0) {
                        baseTokens = tokens.slice(2, i)
                        antilogTokens = tokens.slice(i + 1)
                        break
                    }
                }
            }
        }
        const parsedBase = Expression.parse(baseTokens)
        const parsedAntilog = Expression.parse(antilogTokens)
        if (!parsedBase || !parsedAntilog) {
            return null
        }
        return new Log(parsedBase, parsedAntilog)
    }

    base
    antilog
    constructor(base = null, antilog = null) {
        this.base = base
        this.antilog = antilog
    }
    latex() {
        const baseLatex = this.base.latex()
        return `\\log_${baseLatex.length === 1 ? baseLatex : `{${baseLatex}}`}${this.antilog instanceof Expression && this.antilog.items.length > 1 ? `(${this.antilog.latex()})` : this.antilog.latex()}`
    }
    compute(list) {
        return Math.log(this.antilog.compute(list)) / Math.log(this.base.compute(list))
    }
    allVars() {
        return new Set([...this.base.allVars(), ...this.antilog.allVars()])
    }
    clone() {
        return new Log(this.base.clone(), this.antilog.clone())
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        this.base.substitute(list)
        this.antilog.substitute(list)
    }
    compile(instructions) {
        this.base.compile(instructions)
        this.antilog.compile(instructions)
        instructions.push([FlatComputation.OP.FUNC, this.f()])
    }
    f() {
        return (base, antilog) => Math.log(antilog) / Math.log(base)
    }
}

export class Sin extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\sin') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Sin(parsedArg)
    }

    latex() {
        return `\\sin${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.sin(this.v.compute(list))
    }
    clone() {
        return new Sin(this.v.clone())
    }
    f() {
        return v => Math.sin(v)
    }
}

export class Arcsin extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\sin^{-1}' && tokens[0].value !== '\\arcsin') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Arcsin(parsedArg)
    }

    latex() {
        return `\\sin^{-1}${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.asin(this.v.compute(list))
    }
    clone() {
        return new Arcsin(this.v.clone())
    }
    f() {
        return v => Math.asin(v)
    }
}

export class Cos extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\cos') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Cos(parsedArg)
    }
    latex() {
        return `\\cos${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.cos(this.v.compute(list))
    }
    clone() {
        return new Cos(this.v.clone())
    }
    f() {
        return v => Math.cos(v)
    }
}

export class Arccos extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\cos^{-1}' && tokens[0].value !== '\\arccos') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Arccos(parsedArg)
    }

    latex() {
        return `\\cos^{-1}${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.acos(this.v.compute(list))
    }
    clone() {
        return new Arccos(this.v.clone())
    }
    f() {
        return v => Math.acos(v)
    }
}

export class Tan extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\tan') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Tan(parsedArg)
    }
    latex() {
        return `\\tan${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.tan(this.v.compute(list))
    }
    clone() {
        return new Tan(this.v.clone())
    }
    f() {
        return v => Math.tan(v)
    }
}

export class Arctan extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\tan^{-1}' && tokens[0].value !== '\\arctan') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Arctan(parsedArg)
    }
    latex() {
        return `\\tan^{-1}${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.atan(this.v.compute(list))
    }
    clone() {
        return new Arctan(this.v.clone())
    }
    f() {
        return v => Math.atan(v)
    }
}

export class Csc extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\csc') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Csc(parsedArg)
    }
    latex() {
        return `\\csc${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return 1 / Math.sin(this.v.compute(list))
    }
    clone() {
        return new Csc(this.v.clone())
    }
    f() {
        return v => 1 / Math.sin(v)
    }
}

export class Arccsc extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\csc^{-1}' && tokens[0].value !== '\\arccsc') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Arccsc(parsedArg)
    }

    latex() {
        return `\\csc^{-1}${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.asin(1 / this.v.compute(list))
    }
    clone() {
        return new Arccsc(this.v.clone())
    }
    f() {
        return v => Math.asin(1 / v)
    }
}

export class Sec extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\sec') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Sec(parsedArg)
    }

    latex() {
        return `\\sec${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return 1 / Math.cos(this.v.compute(list))
    }
    clone() {
        return new Sec(this.v.clone())
    }
    f() {
        return v => 1 / Math.cos(v)
    }
}

export class Arcsec extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\sec^{-1}' && tokens[0].value !== '\\arcsec') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Arcsec(parsedArg)
    }

    latex() {
        return `\\sec^{-1}${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.acos(1 / this.v.compute(list))
    }
    clone() {
        return new Arcsec(this.v.clone())
    }
    f() {
        return v => Math.acos(1 / v)
    }
}

export class Cot extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\cot') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Cot(parsedArg)
    }

    latex() {
        return `\\cot${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return 1 / Math.tan(this.v.compute(list))
    }
    clone() {
        return new Cot(this.v.clone())
    }
    f() {
        return v => 1 / Math.tan(v)
    }
}

export class Arccot extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 2 || tokens[0].value !== '\\cot^{-1}' && tokens[0].value !== '\\arccot') {
            return null
        }
        const argTokens =
            tokens[1].value === '(' && tokens[tokens.length - 1].value === ')' ?
                tokens.slice(2, tokens.length - 1) :
                tokens.slice(1)
        const parsedArg = Expression.parse(argTokens)
        if (!parsedArg) {
            return null
        }
        return new Arccot(parsedArg)
    }

    latex() {
        return `\\cot^{-1}${this.v instanceof Expression && this.v.items.length > 1 ? `(${this.v.latex()})` : this.v.latex()}`
    }
    compute(list) {
        return Math.atan(1 / this.v.compute(list))
    }
    clone() {
        return new Arccot(this.v.clone())
    }
    f() {
        return v => Math.atan(1 / v)
    }
}

export class Variable {
    static parse(tokens) {
        if (tokens.length !== 1 || tokens[0].type !== 'VAR') {
            return null
        }
        return new Variable(tokens[0].value)
    }

    name = ''
    v = null
    constructor(name, v = null) {
        this.name = name
        this.v = v
    }
    latex() {
        return this.name
    }
    compute(list = {}) {
        return list[this.name] ? list[this.name] : this.v
    }
    allVars() {
        return [this]
    }
    clone() {
        return new Variable(this.name, this.v)
    }
    hiddenSubstitute(list) {
        if (list[this.name] !== undefined) {
            this.v = list[this.name]
        }
    }
    compile(instructions) {
        instructions.push(
            this.v === null ?
                [FlatComputation.OP.PUSH_VAR, this.name] :
                [FlatComputation.OP.PUSH_CONST, this.v]
        )
    }
}

export class Constant {
    static map = {
        pi: 3.1415926535897932384,
        e: 2.718281828459045,
    }
    static parse(tokens) {
        if (tokens.length !== 1 || tokens[0].type !== 'NUM') {
            return null
        }
        return new Constant(Number(tokens[0].value))
    }

    v = 0
    constructor(v) {
        this.v = v
    }
    latex() {
        return String(this.v)
    }
    compute(list) {
        if (typeof this.v === 'number') return this.v
        return Constant.map[this.v]
    }
    allVars() {
        return []
    }
    clone() {
        return new Constant(this.v)
    }
    compile(instructions) {
        instructions.push([FlatComputation.OP.PUSH_CONST, this.compute()])
    }
}


export const Tokenizer = {
    tokens: [
        {
            type: 'NUM',
            regex: /^-?\d+(\.?\d+)?/
        },
        {
            type: 'OP',
            regex: /^[+\-*/^]/
        },
        {
            type: 'BRACE',
            regex: /^[\(\)\{\}]/
        },
        {
            type: 'SIGN',
            regex: /^(\\ln|\\lg|\\log_|\\sin\^\{-1\}|\\sin|\\arcsin|\\cos\^\{-1\}|\\cos|\\arccos|\\tan\^\{-1\}|\\tan|\\arctan|\\sec\^\{-1\}|\\sec|\\arcsec|\\csc\^\{-1\}|\\csc|\\arccsc|\\cot\^\{-1\}|\\cot|\\arccot|\\frac)/
        },
        {
            type: 'VAR',
            regex: /^[a-zA-Z]/
        },
    ],
    tokenize: function (latex, exStr = []) {
        latex = latex.replace(/\s+/g, '')
        const tokens = []
        let i = 0
        while (i < latex.length) {
            const rest = latex.slice(i)
            let foundEx = false
            for (const e of exStr) {
                if (rest.startsWith(e)) {
                    tokens.push({ type: this.tokenType.EX, value: e })
                    i += e.length
                    foundEx = true
                    break
                }
            }
            if (foundEx) {
                continue
            }
            let foundToken = false
            for (const token of this.tokens) {
                const match = rest.match(token.regex)
                if (match) {
                    tokens.push({ type: token.type, value: match[0] })
                    i += match[0].length
                    foundToken = true
                    break
                }
            }
            if (!foundToken) {
                return null
            }
        }
        return tokens
    }
}

// 测试数据
const tests = [
    '1+1',
    '\\frac{1}{2}+1',
    '3.14^2+\\frac{2}{xy^{22}}',
    '\\sin(2x^x)+\\sin^{-1}x',
    'x^2+0.8^y',
    'x-y',
    '\\sin\\sinx+\\sin^{-1}\\sin^{-1}y'
]
let testFlag = true
for (let i = 0; i < tests.length; i++) {
    try {
        const expr = Expression.parse(tests[i])
        if (expr === null) {
            testFlag = false
            console.log('parse failed for', tests[i])
            continue
        }
        const latex = expr.latex()
        const restoredExpr = Expression.parse(latex)
        const restoredLatex = restoredExpr.latex()
        if (latex !== restoredLatex) {
            testFlag = false
            console.log('latex restore failed for', tests[i])
            console.log('original latex:', latex)
            console.log('restored latex:', restoredLatex)
        }
    } catch(e) {
        testFlag = false
        console.log('error for', tests[i], e)
        console.log(e.stack)
    }
}
if (testFlag) {
    console.log('===correct tests===')
}
// console.log((new Equation('x+y^2=x^2')).latex())


export function parseExpression(latex) {
    // console.log('------PARSE START FOR LATEX:', latex)
    const replacer = [
        [
            /\\left/g, /\\right/g,
            ''
        ],
        [
            /\\cdot/g, /\\times/g,
            '*'
        ],
        [
            /\\div/g,
            '/'
        ],
        [
            /\\frac/g,
            '\\F'
        ],
        [
            /\\pi/g,
            '\\P'
        ],
        [
            /\\ln/g,
            '\\N'
        ],
        [
            /\\log[^_]{1}/g,
            '\\T'
        ],
        [
            /\\lg[^_]{1}/g,
            '\\T'
        ],
        [
            /\\log_/g,
            '\\L'
        ],
        [
            /\\arcsin/g, /\\sin\^{-1}/g,
            '\\Δb'
        ],
        [
            /\\sin/g,
            '\\Δa'
        ],
        [
            /\\arccos/g, /\\cos\^{-1}/g,
            '\\Δd'
        ],
        [
            /\\cos/g,
            '\\Δc'
        ],
        [
            /\\arctan/g, /\\tan\^{-1}/g,
            '\\Δf'
        ],
        [
            /\\tan/g,
            '\\Δe'
        ],
        [
            /\\arcsec/g, /\\sec\^{-1}/g,
            '\\Δh'
        ],
        [
            /\\sec/g,
            '\\Δg'
        ],
        [
            /\\arccsc/g, /\\csc\^{-1}/g,
            '\\Δj'
        ],
        [
            /\\csc/g,
            '\\Δi'
        ],
        [
            /\\arccot/g, /\\cot\^{-1}/g,
            '\\Δl'
        ],
        [
            /\\cot/g,
            '\\Δk'
        ],
    ]
    for (let i = 0; i < replacer.length; i++) {
        for (let j = 0; j < replacer[i].length - 1; j++) {
            latex = latex.replace(replacer[i][j], replacer[i][replacer[i].length - 1])
        }
    }
    // console.log('replaced latex:' + latex)


    const STATES = {
        // for like x+2.0y
        START: 0, // initial state, expect +/-, number, variable
        ITEM_PART: 1, // after +/-
        NUMBER_ZERO_START: 2, // after 0 and no number yet
        NUMBER_POINT: 3, // after .
        NUMBER_INT: 4, // after int part
        NUMBER_DECIMAL: 5, // after decimal part
        VARIABLE: 6, // after variable

        // for like x^2+y^{2+1}
        EXPONENT: 7, // after ^
        AFTER_EXPRESSION: 6, // after } same as VARIABLE

        // for like \left(x+2y\right)^2.1
        LEFT_BRACKET: 0, // after ( same as START
        RIGHT_BRACKET: 6, // after ) same as VARIABLE

        // for like 3\div2
        DIV: 8, // after /
        TIMES: 9, // after * (replaced by \cdot or \times)

        // for like \frac{x}{y}
        ESCAPE: 10, // for \
        E_FRAC: 11,
        FRAC_DENOMINATOR: 12,

        E_PI: 6, // stand for \pi same as VARIABLE

        E_LN: 13,
        E_LN_EXPONENT: 14,
        E_LG: 15,
        E_LOG: 16,
        E_LOG_ANTILOG: 17,

        E_Δ: 18,
        E_Δ_: 19,
    }
    const endable = new Set([
        STATES.NUMBER_ZERO_START,
        STATES.NUMBER_INT,
        STATES.NUMBER_DECIMAL,
        STATES.VARIABLE,
        STATES.AFTER_EXPRESSION,
    ])
    const EXPR_TYPES = {
        NORMAL: 0,
        SHORT_ITEM: 1,
        ARG: 2,
    }

    let state = STATES.START
    const exprStack = [{
        expr: new Expression(),
        type: EXPR_TYPES.NORMAL,
        afterState: STATES.AFTER_EXPRESSION
    }]

    let numberCache = ''
    let currentItem = null

    function endType(type = null) {
        if (type === null && ty() === EXPR_TYPES.NORMAL || type !== null && ty() !== type) return false
        state = af()
        exprStack.pop()
        currentItem = ex().items[ex().items.length - 1]
        return true
    }
    function top() {
        return exprStack[exprStack.length - 1]
    }
    function ex() {
        return top().expr
    }
    function ty() {
        return top().type
    }
    function af() {
        return top().afterState
    }

    for (let i = 0; i < latex.length; i++) {
        // console.log('state:', Object.entries(STATES).find(([k, v]) => v === state)[0], 'char:', latex[i])
        const char = latex[i]
        if (char === ' ') continue

        let pass = false
        let traceback = 1

        while (traceback--) {
            currentItem = ex().items[ex().items.length - 1]
            switch (state) {
                case STATES.START:
                    currentItem = new Item()
                    ex().items.push(currentItem)
                    if (i < latex.length - 1 && (char === '+' || char === '-')) {
                        endType(EXPR_TYPES.SHORT_ITEM)
                        currentItem.positive = char === '+'
                        state = STATES.ITEM_PART
                        pass = true
                    } else if (char >= '1' && char <= '9') {
                        state = STATES.NUMBER_INT
                        numberCache += char
                        pass = true
                    } else if (char === '0') {
                        state = STATES.NUMBER_ZERO_START
                        numberCache += char
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[0].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.ITEM_PART:
                    if (char >= '1' && char <= '9') {
                        state = STATES.NUMBER_INT
                        numberCache += char
                        pass = true
                    } else if (char === '0') {
                        state = STATES.NUMBER_ZERO_START
                        numberCache += char
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.NUMBER_ZERO_START:
                    if (char === '+' || char === '-') {
                        endType(EXPR_TYPES.SHORT_ITEM)
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        ex().items.push(new Item([], char === '+'))
                        numberCache = ''
                        state = STATES.ITEM_PART
                        pass = true
                    } else if (char === '*') {
                        endType(EXPR_TYPES.SHORT_ITEM)
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        state = STATES.TIMES
                        pass = true
                    } else if (char === '/') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        endType(EXPR_TYPES.SHORT_ITEM)
                        const num = new Expression([currentItem.part[currentItem.part.length - 1]])
                        currentItem.part.pop()
                        const newExpr = new Expression([new Item()])
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        currentItem.part.push(new Fraction(num, newExpr))
                        numberCache = ''
                        state = STATES.DIV
                        pass = true
                    } else if (char === '.') {
                        state = STATES.NUMBER_POINT
                        numberCache += char
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        numberCache = ''
                        currentItem.part.push(new Constant(0))
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char === '^') {
                        numberCache = ''
                        currentItem.part.push(new Exponent(new Expression([new Item([new Constant(0)])])))
                        state = STATES.EXPONENT
                        pass = true
                    } else if (char === '(') {
                        numberCache = ''
                        currentItem.part.push(new Constant(0))
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        currentItem.part.push(new Constant(0))
                        numberCache = ''
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.NUMBER_POINT:
                    if (char >= '0' && char <= '9') {
                        state = STATES.NUMBER_DECIMAL
                        numberCache += char
                        pass = true
                    }
                    break
                case STATES.NUMBER_INT:
                    if (char === '+' || char === '-') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        endType(EXPR_TYPES.SHORT_ITEM)
                        ex().items.push(new Item([], char === '+'))
                        numberCache = ''
                        state = STATES.ITEM_PART
                        pass = true
                    } else if (char === '*') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        endType(EXPR_TYPES.SHORT_ITEM)
                        numberCache = ''
                        state = STATES.TIMES
                        pass = true
                    } else if (char === '/') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        endType(EXPR_TYPES.SHORT_ITEM)
                        const num = new Expression([new Item([currentItem.part[currentItem.part.length - 1]])])
                        currentItem.part.pop()
                        const newExpr = new Expression([new Item()])
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        currentItem.part.push(new Fraction(num, newExpr))
                        numberCache = ''
                        state = STATES.DIV
                        pass = true
                    } else if (char >= '0' && char <= '9') {
                        numberCache += char
                        pass = true
                    } else if (char === '.' && i < latex.length - 1) {
                        numberCache += char
                        state = STATES.NUMBER_POINT
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char === '^') {
                        currentItem.part.push(new Exponent(new Expression([new Item([new Constant(parseFloat(numberCache))])])))
                        numberCache = ''
                        state = STATES.EXPONENT
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.NUMBER_DECIMAL:
                    if (char === '+' || char === '-') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        endType(EXPR_TYPES.SHORT_ITEM)
                        ex().items.push(new Item([], char === '+'))
                        numberCache = ''
                        state = STATES.ITEM_PART
                        pass = true
                    } else if (char === '*') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        endType(EXPR_TYPES.SHORT_ITEM)
                        numberCache = ''
                        state = STATES.TIMES
                        pass = true
                    } else if (char === '/') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        endType(EXPR_TYPES.SHORT_ITEM)
                        const num = new Expression([currentItem.part[currentItem.part.length - 1]])
                        currentItem.part.pop()
                        const newExpr = new Expression([new Item()])
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        currentItem.part.push(new Fraction(num, newExpr))
                        numberCache = ''
                        state = STATES.DIV
                        pass = true
                    } else if (char >= '0' && char <= '9') {
                        numberCache += char
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char === '^') {
                        currentItem.part.push(new Exponent(new Expression([new Item([new Constant(parseFloat(numberCache))])])))
                        numberCache = ''
                        state = STATES.EXPONENT
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        currentItem.part.push(new Constant(parseFloat(numberCache)))
                        numberCache = ''
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.VARIABLE:
                    if (char === '+' || char === '-') {
                        endType(EXPR_TYPES.SHORT_ITEM)
                        ex().items.push(new Item([], char === '+'))
                        state = STATES.ITEM_PART
                        pass = true
                    } else if (char === '*') {
                        endType(EXPR_TYPES.SHORT_ITEM)
                        state = STATES.TIMES
                        pass = true
                    } else if (char === '/') {
                        endType(EXPR_TYPES.SHORT_ITEM)
                        const num = new Expression([new Item([currentItem.part[currentItem.part.length - 1]])])
                        currentItem.part.pop()
                        const newExpr = new Expression([new Item()])
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        currentItem.part.push(new Fraction(num, newExpr))
                        state = STATES.DIV
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Variable(char))
                        pass = true
                    } else if (char >= '1' && char <= '9') {
                        state = STATES.NUMBER_INT
                        numberCache += char
                        pass = true
                    } else if (char === '0') {
                        state = STATES.NUMBER_ZERO_START
                        numberCache += char
                        pass = true
                    } else if (char === '^') {
                        currentItem.part[currentItem.part.length - 1] = new Exponent(new Expression([new Item([currentItem.part[currentItem.part.length - 1]])]))
                        state = STATES.EXPONENT
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.EXPONENT:
                    if (char >= '0' && char <= '9') {
                        const ex = new Expression()
                        ex.items.push(new Item([new Constant(parseInt(char))]))
                        currentItem.part[currentItem.part.length - 1].exponent = ex
                        state = STATES.AFTER_EXPRESSION
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        const ex = new Expression()
                        ex.items.push(new Item([new Variable(char)]))
                        currentItem.part[currentItem.part.length - 1].exponent = ex
                        state = STATES.AFTER_EXPRESSION
                        pass = true
                    } else if (char === '{') {
                        const newExpr = currentItem.part[currentItem.part.length - 1].exponent = new Expression()
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    }
                    break
                case STATES.DIV:
                    if (char >= '1' && char <= '9') {
                        state = STATES.NUMBER_INT
                        numberCache += char
                        pass = true
                    } else if (char === '0') {
                        state = STATES.NUMBER_ZERO_START
                        numberCache += char
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.TIMES:
                    if (char >= 'a' && char <= 'z') {
                        currentItem.part.push(new Variable(char))
                        state = STATES.VARIABLE
                        pass = true
                    } else if (char >= '1' && char <= '9') {
                        state = STATES.NUMBER_INT
                        numberCache += char
                        pass = true
                    } else if (char === '0') {
                        state = STATES.NUMBER_ZERO_START
                        numberCache += char
                        pass = true
                    } else if (char === '(') {
                        currentItem.part.push(new Bracket(new Expression()))
                        const newExpr = currentItem.part[currentItem.part.length - 1].v
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.START
                        pass = true
                    } else if (char === '\\') {
                        state = STATES.ESCAPE
                        pass = true
                    }
                    break
                case STATES.ESCAPE:
                    if (char === 'F') {
                        state = STATES.E_FRAC
                        pass = true
                    } else if (char === 'P') {
                        currentItem.part.push(new Constant('pi'))
                        state = STATES.E_PI
                        pass = true
                    } else if (char === 'N') {
                        state = STATES.E_LN
                        pass = true
                    } else if (char === 'T') {
                        state = STATES.E_LG
                        pass = true
                    } else if (char === 'L') {
                        state = STATES.E_LOG
                        pass = true
                    } else if (char === 'Δ') {
                        state = STATES.E_Δ
                        pass = true
                    }
                    break
                case STATES.E_FRAC:
                    if (char === '{') {
                        exprStack.push({
                            expr: new Expression(),
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.FRAC_DENOMINATOR
                        })
                        currentItem.part.push(new Fraction(ex()))
                        state = STATES.START
                        pass = true
                    }
                    break
                case STATES.FRAC_DENOMINATOR:
                    if (char === '{') {
                        exprStack.push({
                            expr: new Expression(),
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.AFTER_EXPRESSION
                        })
                        currentItem.part[currentItem.part.length - 1].denominator = ex()
                        state = STATES.START
                        pass = true
                    }
                    break
                case STATES.E_LN:
                    if (char === '(') {
                        currentItem.part.push(new Ln())
                        const newExpr = currentItem.part[currentItem.part.length - 1].v = new Expression()
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.ARG,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.START
                        pass = true
                    } else {
                        traceback++
                        currentItem.part.push(new Ln())
                        const newExpr = currentItem.part[currentItem.part.length - 1].v = new Expression()
                        newExpr.items.push(new Item())
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.AFTER_EXPRESSION,
                        })
                        state = STATES.ITEM_PART
                    }
                    break
                case STATES.E_LG:
                    if (char === '(') {
                        currentItem.part.push(new Lg())
                        const newExpr = currentItem.part[currentItem.part.length - 1].v = new Expression()
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.ARG,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.START
                        pass = true
                    } else {
                        traceback++
                        currentItem.part.push(new Lg())
                        const newExpr = currentItem.part[currentItem.part.length - 1].v = new Expression()
                        newExpr.items.push(new Item())
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.ITEM_PART
                    }
                    break
                case STATES.E_LOG:
                    currentItem.part.push(new Log())
                    if (char >= '0' && char <= '9') {
                        const base = new Expression()
                        base.items.push(new Item([new Constant(parseInt(char))]))
                        currentItem.part[currentItem.part.length - 1].base = base
                        state = STATES.E_LOG_ANTILOG
                        pass = true
                    } else if (char >= 'a' && char <= 'z') {
                        const base = new Expression()
                        base.items.push(new Item([new Variable(char)]))
                        currentItem.part[currentItem.part.length - 1].base = base
                        state = STATES.E_LOG_ANTILOG
                        pass = true
                    } else if (char === '{') {
                        const newExpr = currentItem.part[currentItem.part.length - 1].base = new Expression()
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.NORMAL,
                            afterState: STATES.E_LOG_ANTILOG,
                        })
                        state = STATES.START
                        pass = true
                    }
                    break
                case STATES.E_LOG_ANTILOG:
                    if (char === '(') {
                        const newExpr = currentItem.part[currentItem.part.length - 1].antilog = new Expression()
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.ARG,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.START
                        pass = true
                    } else {
                        traceback++
                        const newExpr = currentItem.part[currentItem.part.length - 1].antilog = new Expression()
                        newExpr.items.push(new Item())
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.ITEM_PART
                    }
                    break
                case STATES.E_Δ:
                    if (char >= 'a' && char <= 'l') {
                        const trig = [
                            Sin, Arcsin,
                            Cos, Arccos,
                            Tan, Arctan,
                            Sec, Arcsec,
                            Csc, Arccsc,
                            Cot, Arccot,
                        ]
                        currentItem.part.push(new trig[char.charCodeAt(0) - 'a'.charCodeAt(0)])
                        state = STATES.E_Δ_
                        pass = true
                    }
                    break
                case STATES.E_Δ_:
                    if (char === '(') {
                        const newExpr = currentItem.part[currentItem.part.length - 1].v = new Expression()
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.ARG,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.START
                        pass = true
                    } else {
                        traceback++
                        const newExpr = currentItem.part[currentItem.part.length - 1].v = new Expression()
                        newExpr.items.push(new Item())
                        exprStack.push({
                            expr: newExpr,
                            type: EXPR_TYPES.SHORT_ITEM,
                            afterState: STATES.VARIABLE,
                        })
                        state = STATES.ITEM_PART
                    }
                    break
            }
        }

        // 处理Expression结束可能
        if ((char === '}' || char === ')') && exprStack.length > 1 && endable.has(state)) {
            if (numberCache) {
                currentItem.part.push(new Constant(parseFloat(numberCache)))
                numberCache = ''
            }
            if (ex().items.length === 0) {
                // console.log(1)
                return null
            }
            endType(EXPR_TYPES.SHORT_ITEM)
            if (ex().items.length === 0) {
                // console.log(2)
                return null
            }
            if (!endType(EXPR_TYPES.ARG)) {
                state = af()
                exprStack.pop()
            }
            pass = true
        }
        if (!pass) {
            // console.log(3, char)
            return null
        }
        // console.log('char:' + char + '\n' + exprStack.length)
    }
    // 存入数字缓存
    if (numberCache) {
        ex().items[ex().items.length - 1].part.push(new Constant(parseFloat(numberCache)))
        numberCache = ''
    }
    // 检测结果是否合法
    if (!endable.has(state)) {
        // console.log(4)
        return null
    }

    // 后处理
    const expr = exprStack[0].expr
    expr.substitute({ e: new Constant('e') })
    return expr
}

export function parseFunction(latex) {
    const STATES = {
        START: 0,
        NAME: 1,
        ARG_START: 2,
        ARG: 3,
        SPLIT: 4,
        ARG_END: 5,
    }
    let state = STATES.START
    let name
    const args = []
    for (let i = 0; i < latex.length; i++) {
        const char = latex[i]
        let pass = false
        switch (state) {
            case STATES.START: {
                if (char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z') {
                    name = char
                    state = STATES.NAME
                    pass = true
                }
                break
            }
            case STATES.NAME: {
                if (char === '(') {
                    state = STATES.ARG_START
                    pass = true
                }
                break
            }
            case STATES.ARG_START: {
                if (char >= 'a' && char <= 'z') {
                    args.push(char)
                    state = STATES.ARG
                }
                break
            }
            case STATES.ARG: {
                if (char === ',') {
                    state = STATES.SPLIT
                    pass = true
                } else if (char === ')') {
                    state = STATES.ARG_END
                    pass = true
                }
                break
            }
            case STATES.SPLIT: {
                if (char >= 'a' && char <= 'z') {
                    args.push(char)
                    state = STATES.ARG
                    pass = true
                }
                break
            }
            case STATES.ARG_END: {
                pass = true
                break
            }
        }
        if (!pass) {
            return null
        }
    }
    if (state !== STATES.ARG_END) {
        return null
    }
    return new Function(name, args)
}

console.log('---')
console.log(Expression.parse('\\sin^{}'))

