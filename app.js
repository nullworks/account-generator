const request = require("request");
const express = require("express");
const SteamCommunity = require("steamcommunity");
const path = require("path");
const app = express();
const spawn = require("child_process").spawn;
const jsonfile = require("jsonfile");
const bodyparser = require("body-parser");
const querystring = require("querystring");
const RandExp = require("randexp");
const _ = require("underscore");
const fs = require("fs");

const PORT = 8080;

const npid = require('npid');
try
{
    const pid = npid.create('/tmp/ncat-account-generator.pid', true);
    pid.removeOnExit();
}
catch (error)
{
    console.log(`Account generator already running?`);
    process.exit(1);
}

const communityGlobal = new SteamCommunity();
//const SteamUser = require("steam-user");
//var steamUser = new SteamUser();
//steamUser.logOn();

var accounts = [];
try {
	accounts = jsonfile.readFileSync("accounts.json");
} catch (e) {}

function saveAccounts() {
	jsonfile.writeFileSync("accounts.json", accounts);
}

function setupAccount(acc, callback) {
	var sc = new SteamCommunity();
	sc.login({ accountName: acc.login, password: acc.password }, function (err, session) {
		if (err) {
			return callback(err);
		}
		acc.steamID = sc.steamID.getSteamID64();
		console.log(`[${acc.steamID}] Logged in successfully`);
		acc.created = Date.now();
		if (acc.community) {
			sc.setupProfile(function(err) {
				if (err) {
					acc.customURL = null;
					acc.community = 0;
					return callback(err);
				}
				var opt = {};
				if (acc.username) opt.name = acc.username
				if (acc.summary) opt.summary = acc.summary;
				if (acc.customURL) opt.customURL = acc.customURL;
				sc.editProfile(opt, function(err) {
					if (err) {
						console.log(`[${acc.steamID}] Error editing profile: ${err}`);
					}
					if (acc.group) {
						sc.getSteamGroup(acc.group, function(err, group) {
							if (err) {
								console.log(`[${acc.steamID}] Error while joining group: ${err}`);
								return;
							}
							group.join();
						});
					}
					if (acc.privacy) {
						sc.profileSettings(acc.privacy);
					}
					if (acc.avatar) {
						sc.uploadAvatar(acc.avatar, function(err) {
							if (err) {
								console.log(`[${acc.steamID}] Error while uploading avatar: ${err}`);
							}
						});
					}
					callback(null, acc);
				});
			});
		} else {
			callback(null, acc);
		}
	});
}

function makeAccount(user, data, callback) {
	user.createAccount(data.login, data.password, data.email, function(result, steamID) {
		/* node-steam-user docs say that steamID is always null, so I'll get it in setupAccount */
		if (result == SteamUser.EResult.OK) {
			callback(null, data);
		} else {
			callback(result);
		}
	});
}

const session = require('express-session');

app.use(session({
    secret: require('randomstring').generate(16),
    resave: false,
    saveUninitialized: false
}))
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

const SimpleAuth = require('./auth');
const basicAuth = new SimpleAuth(app);
basicAuth.storeAPIKey('/tmp/accgen2-apikey');
console.log('Login with password', basicAuth.password);
fs.writeFileSync('/tmp/cat-accgen2-password', basicAuth.password);

// Check if custom URL is available
app.get("/api/check/:url", function(req, res) {
	communityGlobal.getSteamUser(req.params.url, function (error, user) {
		if (error && error.toString().indexOf("not be found") > 0) {
			res.send("1");
			return;
		}
		res.send("0");
	});
});

// Return new CAPTCHA gid
app.get("/api/captcha", function(req, res) {
	request("https://store.steampowered.com/join/refreshcaptcha?count=1", function(e, r, b) {
		if (e) {
			console.log(err);
			res.status(500).send("0");
			return;
		}
		var gid = 0;
		try {
			gid = JSON.parse(b).gid;
		} catch (e) {
			console.log(e);
			res.status(500).send("0");
			return;
		}
		res.send(gid);
	});
});

// Return N newest accounts from the list, return account number
app.get("/api/list/:from/:count", function(req, res) {
	var from = parseInt(req.params.from);
	var count = parseInt(req.params.count);
	if (isNaN(from) || isNaN(count)) {
		res.status(400).send("NaN");
		return;
	}
	var accs = accounts.slice(Math.max(0, accounts.length - 1 - from - count), Math.max(0, accounts.length - from));
	var result = {
		total: accounts.length,
		from: from,
		count: accs.length,
		accounts: accs
	};
	res.send(JSON.stringify(result));
});

// Create an account, return its data on success
app.post("/api/create", function(req, res) {
	console.log("Creating account", req.body);
	makeAccount(steamUser, req.body, function(err, data) {
		if (err) {
			console.log(err, data);
			res.status(500).send(JSON.stringify(data));
			return;
		}
		console.log('Created?');
		steamUser.logOff();
		steamUser = new SteamUser();
		steamUser.logOn({
			accountName: data.login,
			password: data.password
		});
		data.created = true;
		setupAccount(data, function(err, data) {
			if (err) {
				console.log(err, data);
				res.status(500).send(JSON.stringify(data));
				return;
			}
			accounts.push(data);
			saveAccounts();
			res.send(JSON.stringify(data));
		});
	});
});

// Start steam and log in to account
app.post("/api/steam/login/:username/:password", function(req, res) {
	const killall = spawn("killall", ["-9", "steam"]);
	killall.on("exit", () => {
		console.log(["-login", req.params.username, req.params.password].concat(req.body));
		spawn("steam", ["-login", req.params.username, req.params.password].concat(req.body));
	});
	res.status(200).end();
});

const CG_MIN_TIMEOUT = 45 * 1000;

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

const cgAccounts = {
	status: function() {
		return {
			count: this.array.length,
			used: this.used
		};
	},
	load: function() {
		try {
			var data = jsonfile.readFileSync("accounts.cg.json");
			if (_.isArray(data)) {
				this.array = data;
				this.used = 0;
			} else if (_.isObject(data)) {
				this.array = data.array;
				this.used = data.used;
			} else throw "malformed accounts.cg.json file";
		} catch (err) {
			this.array = [];
			this.used = 0;
			console.log("[CG] Error loading data:", err);
			try
			{
				var data = jsonfile.readFileSync("accounts.default.json");
				if (_.isArray(data)) {
					this.array = data;
					shuffle(this.array);
					this.used = 0;
					console.log("Loaded default data");
				} else if (_.isObject(data)) {
					this.array = data.array;
					shuffle(this.array);
					this.used = 0;
					console.log("Loaded default data");
				} else throw "malformed accounts.default.json file";
			}
			catch (err) {
				this.array = [];
				this.used = 0;
				console.log("[DEFAULT] Error loading data:", err);
			}
		}
	},
	save: function() {
		jsonfile.writeFileSync("accounts.cg.json", {
			array: this.array,
			used: this.used
		});
	},
	push: function(account) {
		console.log("[CG] Storing account");
		this.array.push(account);
		this.save();
		console.log("[CG] Saving complete");
	},
	pop: function() {
		console.log("[CG] Popping account");
		var acc = this.array.shift();
		this.used++;
		this.save();
		fs.appendFileSync("accs-cg-used.txt", `${acc.created} ${Date.now()} ${acc.login} ${acc.password} ${acc.steamID}\n`);
		return acc;
	},
	array: [],
	used: 0
};

// Continious Generation
const cg = {
	user: null,
	active: false,
	cfg: {
		timeout: 2 * 60 * 1000,
		limit: 0,
		preset: {
			community: true,
			privacy: {
				profile: "3",
				comments: "3"
			},
			avatar: "http://i.imgur.com/l15FXXV.jpg",
			summary: "Generated by nullifiedcat's account generator"
		},
		username: {
			type: "regexp",
			data: "(motorized|mecha(ni(cal|zed))?|electr(o|ical)|auto(mat(ed|ic))?|robo(t(ic)?)?|artificial|metal|nano(tech)?|cyber(netic)?) (feline|tabby|(bob|tom)?cat|feline|lynx|tom|kitty|cheetah|ocelot)"
		}
	},
	handle: 0,
	next: function next() {
		try {
			if (this.cfg.limit && cgAccounts.status().count > this.cfg.limit) {
				throw "Too many accounts in cache!"
			}
			var cg_account = {
				login: new RandExp("[a-z0-9]{20}").gen(),
				password: new RandExp("[a-z0-9]{20}").gen(),
				email: new RandExp("[a-z0-9]{20}@[a-z0-9]{3}\\.com").gen()
			};
			cg_account = _.extend(cg_account, cg.cfg.preset);
			if (cg.cfg.username.type == "regexp") {
				cg_account.username = new RandExp(cg.cfg.username.data).gen()
			} else if (cg.cfg.username.type == "string") {
				cg_account.username = cg.cfg.username.data;
			}
			console.log("[CG] Generating account:", cg_account.login);

			makeAccount(this.user, cg_account, function(err, data) {
				if (err) {
					console.log(`[CG] Account creation failed: ${err} ${data}`);
					return;
				}
				//cg.user.logOff();
				//cg.user = new SteamUser();
				//cg.user.logOn({
				//	accountName: data.login,
				//	password: data.password
				//});
				data.created = true;
				setupAccount(data, function(err, data) {
					if (err) {
						console.log(`[CG] Account setup failed: ${err} ${data}`);
						return;
					}
					cgAccounts.push(data);
				});
			});
		} catch (e) {
			console.log(e);
		}
		if (cg.cfg.timeout < CG_MIN_TIMEOUT) {
			console.log("cg.timeout < CG_MIN_TIMEOUT (", cg.cfg.timeout, ")");
			cg.cfg.timeout = CG_MIN_TIMEOUT;
		}
		cg.handle = setTimeout(cg.next.bind(cg), cg.cfg.timeout);
	},
	stop: function stop() {
		cg.active = false;
		if (cg.handle) {
			clearTimeout(cg.handle);
			cg.handle = 0;
			console.log("[CG] Stopped");
		}
	},
	start: function start() {
		cg.active = true;
		if (!cg.handle) {
			cg.handle = setTimeout(cg.next.bind(cg), 0);
			console.log("[CG] Starting");
		}
	}
};

cgAccounts.load();
//cg.user = new SteamUser();
//cg.user.logOn();

app.get("/api/cg/start", function(req, res) {
	cg.start();
	res.end();
});

app.get("/api/cg/stop", function(req, res) {
	cg.stop();
	res.end();
});

app.get("/api/cg/status", function(req, res) {
	res.send({
		active: cg.active,
		timeout: cg.cfg.timeout,
		preset: cg.cfg.preset,
		username: cg.cfg.username,
		accounts: cgAccounts.status()
	});
});

function reloadCGConfig() {
	try {
		var cfg = jsonfile.readFileSync("cg-config.json");
		cg.cfg = cfg;
	} catch (e) {}
}

app.get("/api/cg/reload", function(req, res) {
	reloadCGConfig();
	res.end();
});

app.get("/api/cg/pop", function(req, res) {
	var acc = cgAccounts.pop();
	if (acc) {
		res.send({
			count: cgAccounts.status().count,
			account: acc
		});
	} else {
		res.status(429).end();
	}
	cgAccounts.push(acc);
});

reloadCGConfig();

app.listen(PORT, function() {
	console.log("Listening on port", PORT);
});
