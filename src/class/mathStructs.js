
export const Tokenizer = {
    tokens: [
        {
            type: 'OP',
            regex: /^[+\-*/^]/
        },
        {
            type: 'NUM',
            regex: /^-?\d+(\.?\d+)?/
        },
        {
            type: 'BRACE',
            regex: /^[\(\)\{\}]/
        },
        {
            type: 'SIGN',
            regex: /^\\(ln|lg|log_|sin\^\{-1\}|sin|arcsin|cos\^\{-1\}|cos|arccos|tan\^\{-1\}|tan|arctan|sec\^\{-1\}|sec|arcsec|csc\^\{-1\}|csc|arccsc|cot\^\{-1\}|cot|arccot|frac)/
        },
        {
            type: 'SPLIT',
            regex: /^(,|=)/
        },
        {
            type: 'CHAR',
            regex: /^[a-zA-Z]/
        },
    ],
    preprocess(latex) {
        latex = latex
            .replace(/\s+/g, '')
            .replace(/\\left|\\right/g, '')
        return latex
    },
    tokenize: function (latex) {
        latex = this.preprocess(latex)
        const tokens = []
        let i = 0
        while (i < latex.length) {
            const rest = latex.slice(i)
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
    _linkComplete = null
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
            this.rhs = new Expression([new Item([new Num(0)])])
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
            this.allVarsCache = [...this.lhs.allVars(), ...this.rhs.allVars()]
            .reduce((acc, c) => {
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
        this.rhs.items = [new Item([new Num(0)])]
        this.formed = true
    }
    clone() {
        const cloned = new Equation(this.lhs.clone(), this.rhs.clone())
        cloned.formed = this.formed
        cloned.allVarsCache = null
        cloned._linkComplete = null
        return cloned
    }
    /**
     * 隐式地把值代入变量，在计算的时候会把变量识别为Num
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
        let varName = vars[0].name
        const roots = []
        let tempY = this.lhs.compute({ [varName]: min })
        let lastY
        if (typeof tempY !== 'number' || isNaN(tempY)) {
            lastY = null
        } else {
            lastY = tempY
        }
        for (let v = min; v <= max; v += granularity) {
            const y = this.lhs.compute({ [varName]: v })
            if (typeof y !== 'number' || isNaN(y)) {
                lastY = null
                continue
            }
            if (lastY !== null) {
                if (lastY * y <= 0) {
                    let left = v - granularity, right = v
                    const oLeftValue = lastY
                    const oRightValue = y
                    let leftValue = oLeftValue, rightValue = oRightValue
                    const rising = y > 0
                    while (right - left >= maxGap) {
                        const mid = (left + right) / 2
                        const y = this.lhs.compute({ [varName]: mid })
                        if (y < 0) {
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
                        roots.push((left + right) / 2)
                    }
                }
            }
            lastY = y
        }
        return roots
    }
    linkFunction(funcDefs) {
        this.lhs.linkFunction(funcDefs)
        this.rhs.linkFunction(funcDefs)
        this._linkComplete = null
    }
    dislinkFunction() {
        this.lhs.dislinkFunction()
        this.rhs.dislinkFunction()
        this._linkComplete = null
    }
    linkComplete() {
        if (this._linkComplete !== null) {
            return this._linkComplete
        }
        return this._linkComplete = this.lhs.linkComplete() && this.rhs.linkComplete()
    }
    allFunctions() {
        return [...new Set([...this.lhs.allFunctions(), ...this.rhs.allFunctions()])]
    }
    replaceFunction(funcDefs) {
        this.lhs.replaceFunction(funcDefs)
        this.rhs.replaceFunction(funcDefs)
    }
}

export class VariableDefinition {
    static parse(arg) {
        const tokens = Array.isArray(arg) ? arg : Tokenizer.tokenize(arg)
        if (tokens !== null && (tokens.length === 3 || tokens.length === 4) && tokens[0].type === 'CHAR' && tokens[0].value !== 'x' && tokens[0].value !== 'y' && tokens[1].value === '=') {
            if (tokens.length === 3 && tokens[2].type === 'NUM') {
                return new VariableDefinition(tokens[0].value, parseFloat(tokens[2].value))
            } else if (tokens.length === 4 && (tokens[2].value === '-' || tokens[2].value === '+') && tokens[3].type === 'NUM') {
                return new VariableDefinition(tokens[0].value, parseFloat(tokens[2].value + tokens[3].value))
            }
        }
        return null
    }

    name
    v
    constructor(name, v) {
        this.name = name
        this.v = v
    }
}

export class FunctionDefinition {
    static states = {
        START: 0,
        NAME: 1,
        LEFT_BRACE: 2,
        VAR: 3,
        SPLIT: 4,
        RIGHT_BRACE: 5,
    }
    static parse(arg) {
        const tokens = Array.isArray(arg) ? arg : Tokenizer.tokenize(arg)
        if (tokens === null) {
            return null
        }
        let state = FunctionDefinition.states.START
        let i = 0
        let name
        let params = []
        let invalid = false
        while (i < tokens.length) {
            const token = tokens[i]
            switch (state) {
                case FunctionDefinition.states.START: {
                    if (token.type === 'CHAR') {
                        state = FunctionDefinition.states.NAME
                        name = token.value
                    } else {
                        invalid = true
                    }
                    break
                }
                case FunctionDefinition.states.NAME: {
                    if (token.value === '(') {
                        state = FunctionDefinition.states.LEFT_BRACE
                    } else {
                        invalid = true
                    }
                    break
                }
                case FunctionDefinition.states.LEFT_BRACE: {
                    if (token.type === 'CHAR') {
                        state = this.states.VAR
                        params.push(token.value)
                    } else {
                        invalid = true
                    }
                    break
                }
                case this.states.VAR: {
                    if (token.value === ',') {
                        state = this.states.SPLIT
                    } else if (token.value === ')') {
                        state = this.states.RIGHT_BRACE
                    } else {
                        invalid = true
                    }
                    break
                }
                case this.states.SPLIT: {
                    if (token.type === 'CHAR') {
                        state = FunctionDefinition.states.VAR
                        params.push(token.value)
                    } else {
                        invalid = true
                    }
                    break
                }
            }
            i++
            if (invalid || state === FunctionDefinition.states.RIGHT_BRACE) {
                break
            }
        }
        if (invalid || state !== FunctionDefinition.states.RIGHT_BRACE || i === tokens.length || tokens[i].value !== '=') {
            return null
        }
        const funcContent = Expression.parse(tokens.slice(i + 1))
        if (funcContent === null) {
            return null
        }
        const extraVars = funcContent.allVars().map(v => v.name).filter(v => !params.includes(v))
        return new FunctionDefinition(name, params, funcContent, extraVars)
    }

    name
    params
    expr
    extraVars
    constructor(name, params, expr, extraVars) {
        this.name = name
        this.params = params
        this.expr = expr
        this.extraVars = extraVars
    }
    compute(params, list) {
        // const newList = { ...list }
        for (let i = 0; i < this.params.length; i++) {
            // newList[this.params[i]] = params[i]
            list[this.params[i]] = params[i]
        }
        // return this.expr.compute(newList)
        return this.expr.compute(list)
    }
}

export class Expression {
    static parse(arg) {
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
        const expr = new Expression(items)
        expr.substitute({ e: Num.map.e })
        return expr
    }

    items = []
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
    flatCompute(list) {
        if (this.instruction === null) {
            this.instruction = new FlatComputation(this)
        }
        return this.instruction.compute(list)
    }
    linkFunction(funcDefs) {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].linkFunction(funcDefs)
        }
    }
    dislinkFunction() {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].dislinkFunction) this.items[i].dislinkFunction()
        }
    }
    linkComplete() {
        for (let i = 0; i < this.items.length; i++) {
            if (!this.items[i].linkComplete()) return false
        }
        return true
    }
    allFunctions() {
        return this.items.reduce((acc, c) => {
            return [...new Set([...acc, ...c.allFunctions()])]
        }, [])
    }
    replaceFunction(funcDefs) {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].replaceFunction(funcDefs)
        }
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
            _Function.parse,
            Bracket.parse,
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
            Num.parse,
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
                        // console.log(parser[k])
                        // console.log(JSON.stringify(subtokens, null, 2))
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
        return (this.positive ? '' : '-') + this.part.map((p, i) => (p instanceof Num && typeof p.v === 'number' && i > 0 && this.part[i - 1] instanceof Num && typeof this.part[i - 1].v === 'number' ? '\\cdot' : '') + p.latex()).join('')
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
                    this.part[i] = new Num(v)
                } else {
                    this.part[i] = v
                }
            } else if (this.part[i].substitute) {
                this.part[i].substitute(list)
            }
        }
    }
    linkFunction(funcDefs) {
        for (let i = 0; i < this.part.length; i++) {
            if (this.part[i].linkFunction) {
                this.part[i].linkFunction(funcDefs)
            }
        }
    }
    dislinkFunction() {
        for (let i = 0; i < this.part.length; i++) {
            if (this.part[i].dislinkFunction) {
                this.part[i].dislinkFunction()
            }
        }
    }
    linkComplete() {
        for (let i = 0; i < this.part.length; i++) {
            if (this.part[i].linkComplete && !this.part[i].linkComplete()) return false
        }
        return true
    }
    allFunctions() {
        return this.part.reduce((acc, c) => {
            return [...new Set([...acc, ...(c.allFunctions ? c.allFunctions() : [])])]
        }, [])
    }
    replaceFunction(funcDefs) {
        for (let i = 0; i < this.part.length; i++) {
            if (this.part[i] instanceof _Function) {
                const def = funcDefs.find(d => d.name === this.part[i].name && d.params.length === this.part[i].params.length)
                if (def === undefined) {
                    return
                }
                const expr = def.expr.clone()
                const params = {}
                // console.log(JSON.stringify(this.part[i].params, null, 2))
                for (let j = 0; j < def.params.length; j++) {
                    params[def.params[j]] = this.part[i].params[j]
                }
                expr.substitute(params)
                // console.log(expr)
                expr.replaceFunction(funcDefs)
                this.part[i] = new Bracket(expr)
            } else if (this.part[i].replaceFunction) {
                this.part[i].replaceFunction(funcDefs)
            }
        }
    }
}

export class Fraction {
    static parse(tokens) {
        if (tokens.length < 7 || tokens[0].value !== '\\frac' || tokens[1].value !== '{' || tokens[tokens.length - 1].value !== '}') {
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
    linkFunction(funcDefs) {
        this.numerator.linkFunction(funcDefs)
        this.denominator.linkFunction(funcDefs)
    }
    dislinkFunction() {
        this.numerator.dislinkFunction()
        this.denominator.dislinkFunction()
    }
    linkComplete() {
        return this.numerator.linkComplete() && this.denominator.linkComplete()
    }
    allFunctions() {
        return [...new Set([...this.numerator.allFunctions(), ...this.denominator.allFunctions()])]
    }
    replaceFunction(funcDefs) {
        this.numerator.replaceFunction(funcDefs)
        this.denominator.replaceFunction(funcDefs)
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
    linkFunction(funcDefs) {
        this.base.linkFunction(funcDefs)
        this.exponent.linkFunction(funcDefs)
    }
    dislinkFunction() {
        this.base.dislinkFunction()
        this.exponent.dislinkFunction()
    }
    linkComplete() {
        return this.base.linkComplete() && this.exponent.linkComplete()
    }
    allFunctions() {
        return [...new Set([...this.base.allFunctions(), ...this.exponent.allFunctions()])]
    }
    replaceFunction(funcDefs) {
        this.base.replaceFunction(funcDefs)
        this.exponent.replaceFunction(funcDefs)
    }
}

export class Root {

}

export class _Function {
    static parse(tokens) {
        if (tokens.length < 4 || tokens[0].type !== 'CHAR' || tokens[1].value !== '(' || tokens[tokens.length - 1].value !== ')') {
            return null
        }
        const name = tokens[0].value
        const params = []
        let lastSplitIndex = 1
        let braceCount = 0
        for (let i = 2; i < tokens.length; i++) {
            if (tokens[i].value === '(') {
                braceCount++
            } else if (tokens[i].value === ')') {
                braceCount--
            }
            if (tokens[i].value === ',' && braceCount === 0 || i === tokens.length - 1) {
                const parsedParam = Expression.parse(tokens.slice(lastSplitIndex + 1, i))
                if (parsedParam === null) {
                    return null
                }
                params.push(parsedParam)
                lastSplitIndex = i
            }
        }
        return new _Function(name, params)
    }

    name
    params
    definition
    constructor(name, params, definition = null) {
        this.name = name
        this.params = params
        this.definition = definition
    }
    latex() {
        return `${this.name}\\left(${this.params.map(p => p.latex()).join()}\\right)`
    }
    allVars() {
        return this.params.reduce((acc, c) => {
            const vars = c.allVars()
            for (let i = 0; i < vars.length; i++) {
                if (acc.find(v => v.name === vars[i].name) === undefined) {
                    acc.push(vars[i])
                }
            }
            return acc
        }, [])
    }
    compute(list) {
        const computedParams = this.params.map(p => p.compute(list))
        return this.definition.compute(computedParams, list)
    }
    clone() {
        return new _Function(this.name, this.params.map(p => p.clone()), this.definition)
    }
    hiddenSubstitute(list) {
        for (let i = 0; i < this.params.length; i++) {
            this.params[i].hiddenSubstitute(list)
        }
    }
    substitute(list) {
        for (let i = 0; i < this.params.length; i++) {
            this.params[i].substitute(list)
        }
    }
    linkFunction(funcDefs) {
        const target = funcDefs.find(d => d.name === this.name && d.params.length === this.params.length)
        if (target) {
            this.definition = target
            this.definition.expr.linkFunction(funcDefs)
        }
    }
    dislinkFunction() {
        this.definition = null
    }
    linkComplete() {
        if (this.definition === null || !this.definition.expr.linkComplete()) return false
        for (let i = 0; i < this.params.length; i++) {
            if (!this.params[i].linkComplete()) return false
        }
        return true
    }
    allFunctions() {
        return [this.name]
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
    linkFunction(funcDefs) {
        this.v.linkFunction(funcDefs)
    }
    dislinkFunction() {
        this.v.dislinkFunction()
    }
    linkComplete() {
        return this.v.linkComplete()
    }
    allFunctions() {
        return this.v.allFunctions()
    }
    replaceFunction(funcDefs) {
        this.v.replaceFunction(funcDefs)
    }
}

export class Bracket extends SimpleFunc {
    static parse(tokens) {
        if (tokens.length < 3 || tokens[0].value !== '(' || tokens[tokens.length - 1].value !== ')') {
            return null
        }
        const parsedV = Expression.parse(tokens.slice(1, tokens.length - 1))
        if (!parsedV) {
            return null
        }
        return new Bracket(parsedV)
    }

    latex() {
        return `(${this.v.latex()})`
        // return `\\left(${this.v.latex()}\\right)`
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
        if (!baseTokens || !antilogTokens) {
            return null
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
        const baseVars = this.base.allVars()
        const antiVars = this.antilog.allVars()
        for (let i = 0; i < antiVars.length; i++) {
            if (!baseVars.find(v => v.name === antiVars[i].name)) {
                baseVars.push(antiVars[i])
            }
        }
        return baseVars
    }
    clone() {
        return new Log(this.base.clone(), this.antilog.clone())
    }
    dislinkFunction() {
        this.base.dislinkFunction()
        this.antilog.dislinkFunction()
    }
    linkComplete() {
        return this.base.linkComplete() && this.antilog.linkComplete()
    }
    /**
     * 把变量代入具体值
     * @param {*} list 存储代入的对象的值，可以是number或object
     */
    substitute(list) {
        this.base.substitute(list)
        this.antilog.substitute(list)
    }
    hiddenSubstitute(list) {
        this.base.hiddenSubstitute(list)
        this.antilog.hiddenSubstitute(list)
    }
    linkFunction(funcDefs) {
        this.base.linkFunction(funcDefs)
        this.antilog.linkFunction(funcDefs)
    }
    replaceFunction(funcDefs) {
        this.base.replaceFunction(funcDefs)
        this.antilog.replaceFunction(funcDefs)
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
        if (tokens.length !== 1 || tokens[0].type !== 'CHAR') {
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
}

export class Num {
    static map = {
        pi: 3.1415926535897932384,
        e: 2.718281828459045,
    }
    static parse(tokens) {
        if (tokens.length !== 1 || tokens[0].type !== 'NUM') {
            return null
        }
        return new Num(Number(tokens[0].value))
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
        return Num.map[this.v]
    }
    allVars() {
        return []
    }
    clone() {
        return new Num(this.v)
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
    } catch (e) {
        testFlag = false
        console.log('error for', tests[i], e)
        console.log(e.stack)
    }
}
if (testFlag) {
    console.log('===correct tests===')
}


console.log(JSON.stringify(new VariableDefinition('a=-1'), null, 2))
console.log(JSON.stringify(Tokenizer.tokenize('a=-1'), null, 2))
console.log(JSON.stringify(Expression.parse('-1'), null, 2))
