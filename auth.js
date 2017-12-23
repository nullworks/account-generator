const randomstring = require('randomstring');
const fs = require('fs');

class SimpleAuth
{
    constructor(app)
    {
        this.password = randomstring.generate(8);
        this.apikey = randomstring.generate(64);

        app.post('/api/auth', this.handleLogin.bind(this));
        app.use(this.middleware.bind(this));
    }
    middleware(req, res, next)
    {
        if (!req.session.auth && (req.ip == '::1' || req.ip == '127.0.0.1' || req.ip == '::ffff:127.0.0.1'))
        {
            console.log(`Auth: ${req.ip} by LOCAL`);
            req.session.auth = 1;
        }

        if (req.url.indexOf('api') < 0 || req.session.auth)
        {
            next();
            return;
        }

        if (req.query.key)
        {
            if (req.query.key === this.apikey)
            {
                console.log(`Auth: ${req.ip} by apikey`);
                req.session.auth = 1;
            }
            else
            {
                console.log(`Auth fail: ${req.ip} by invalid apikey ${req.query.key}`)
            }
        }

        if (!req.session.auth)
        {
            res.status(403).end('Not authorized');
            return;
        }
        next();
    }
    handleLogin(req, res)
    {
        if (req.body.password === this.password)
        {
            console.log(`Auth: ${req.ip} by password ${req.body.password}`);
            req.session.auth = 1;
            res.status(200).end();
        }
        else
        {
            console.log(`Auth fail: ${req.ip} by password ${req.body.password}`);
            res.status(403).end();
        }
    }
    storeAPIKey(path)
    {
        fs.writeFileSync(path, this.apikey);
    }
}

module.exports = SimpleAuth;
