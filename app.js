const request = require("request");
const express = require("express");
const SteamCommunity = require("steamcommunity");
const path = require("path");
const app = express();
const spawn = require("child_process").spawn;
const jsonfile = require("jsonfile");
const bodyparser = require("body-parser");
const querystring = require("querystring");

const PORT = 8080;

const communityGlobal = new SteamCommunity();

var accounts = [];
try {
	accounts = jsonfile.readFileSync("accounts.json");
} catch (e) {}

function saveAccounts() {
	jsonfile.writeFileSync("accounts.json", accounts);
}

function setupAccount(acc, callback) {
	console.log("Creating account!");
	var sc = new SteamCommunity({});
	sc.login({ accountName: acc.login, password: acc.password }, function (err, session) {
		if (err) {
			return callback(err);
		}
		acc.steamID = sc.steamID.getSteamID64();
		console.log("Created account: ", acc.steamID);
		acc.created = Date.now();
		if (acc.community) {
			sc.setupProfile(function(err) {
				if (err) {
					acc.customURL = null;
					acc.community = 0;
					return callback(err);
				}
				console.log("Editing profile");
				var opt = {
					name: acc.username
				};
				if (acc.summary) opt.summary = acc.summary;
				if (acc.customURL) opt.customURL = acc.customURL;
				sc.editProfile(opt, function(err) {
					if (err) {
						console.log("Error editing profile?");
					}
					if (acc.group) {
						sc.getSteamGroup(acc.group, function(err, group) {
							if (err) {
								console.log("Error getting group", err);
								return;
							}
							group.join();
						});
					}
					if (acc.avatar) {
						console.log("Uploading avatar");
						sc.uploadAvatar(acc.avatar, function(err) {
							if (err) {
								console.log("Avatar error", err);
							} else {
								console.log("Avatar uploaded");
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

function makeAccount(data, callback) {
	request.post({
		uri: "https://store.steampowered.com/join/createaccount/",
		body: querystring.stringify({
			accountname: data.acc.login,
			password: data.acc.password,
			email: data.acc.email,
			captchagid: data.gid,
			captcha_text: data.captcha,
			i_agree: 1,
			ticket: "",
			count: 1
		}),
		headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		}
	}, function(e, r, b) {
		if (e) {
			callback(e, b);
			return;
		}
		if (b.indexOf('true') > 0) {
			callback(null, data.acc);
		} else {
			callback("Other error", b);
		}
		return;
	});
}

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

// Check if custom URL is available
app.get("/check/:url", function(req, res) {
	communityGlobal.getSteamUser(req.params.url, function (error, user) {
		if (error && error.toString().indexOf("not be found") > 0) {
			res.send("1");
			return;
		}
		res.send("0");
	});
});

// Return new CAPTCHA gid
app.get("/captcha", function(req, res) {
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
app.get("/list/:from/:count", function(req, res) {
	var from = parseInt(req.params.from);
	var count = parseInt(req.params.count);
	if (isNaN(from) || isNaN(count)) {
		res.status(400).send("NaN");
		return;
	}
	var accs = accounts.slice(Math.max(0, accounts.length - 1 - from - count), accounts.length - from);
	var result = {
		total: accounts.length,
		from: from,
		count: accs.length,
		accounts: accs
	};
	res.send(JSON.stringify(result));
});

// Create an account, return its data on success
app.post("/create", function(req, res) {
	console.log("Creating account", req.body);
	makeAccount(req.body, function(err, data) {
		if (err) {
			console.log(err, data);
			res.status(500).end();
			return;
		}
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
app.get("/steam/login/:username/:password", function(req, res) {
	const killall = spawn("killall", ["-9", "steam"]);
	killall.on("exit", () => {
		spawn("steam", ["-login", req.params.username, req.params.password]);
	});
	res.status(200).end();
});

app.listen(PORT, function() {
	console.log("Listening on port", PORT);
});