const $ = require("jquery");
const pad = require("pad-number");
const RandExp = require("randexp");
const request = require("browser-request");

const SERVER = "http://localhost:8080/";

var gid = "";

var status;

function LoginButtonCallback() {
	var tr = $(this).parent().parent();
	var username = tr.find(":nth-child(2)").text();
	var password = tr.find(":nth-child(3)").text();
	StartSteam(username, password);
}

function StoreAccount(acc) {
	accounts.push(acc);
	localStorage.accounts = JSON.stringify(accounts);
}

function PushAccount(acc) {
	var tr = $("<tr></tr>");
	tr.append($("<td></td>").text(acc.username));
	tr.append($("<td></td>").text(acc.login));
	tr.append($("<td></td>").text(acc.password));
	if (acc.customURL) {
		tr.append($("<td></td>").append($("<a></a>").attr("href", "https://steamcommunity.com/id/" + acc.customURL).attr("target", "_blank").text(acc.customURL)));
	} else {
		tr.append($("<td></td>").append($("<a></a>").attr("href", "https://steamcommunity.com/profiles/" + acc.steamID).attr("target", "_blank").text(acc.steamID)));
	}
	tr.append($("<td></td>").text(new Date(acc.created).toLocaleString()));
	tr.append($("<td></td>").append($("<a></a>").attr("href", "#").text("Login").on("click", LoginButtonCallback)));
	$("#list tbody").append(tr);
	return tr;
}

function fetchAccountList() {
	request(SERVER + "list/" + $("#list-page").val() * 20 + "/20", function(e, r, b) {
		if (e) {
			console.log(e);
			return;	
		}
		var data = JSON.parse(b);
		$("#list tr").slice(1).remove();
		$("#list-info-first").text(data.from);
		$("#list-info-last").text(data.from + data.count);
		$("#list-info-total").text(data.total);
		for (var i = data.count - 1; i >= 0; i--) {
			PushAccount(data.accounts[i]);
		};
	});
}

var accountSequenceNumber = 0;

function CheckCustomURL() {
	$("#custom-url").attr("class", "progress");
	request(SERVER + "check/" + $("#custom-url").val(), function(err, res, body) {
		if (body == "1") {
			$("#custom-url").attr("class", "good");
		} else {
			$("#custom-url").attr("class", "bad");
		}
	});
}

function RefreshCaptcha() {
	$("#captcha-img").attr("src", "").attr("class", "progress");
	request(SERVER + "captcha", function(err, res, body) {
		if (res.statusCode != 200) {
			console.log("Internal server error?");
			$("#captcha-img").attr("class", "bad");
			return;
		}
		$("#captcha-img").attr("src", "https://store.steampowered.com/public/captcha.php?gid=" + body).attr("class", "good");
		gid = body;
		$("#captcha").val("");
	});
}

function MakeAccount() {
	var acc = ValidateAndStoreFields();
	if (acc) {
		status.text("Creating account");
		request.post({
			url: SERVER + "create", 
			body: JSON.stringify({
				acc: acc,
				gid: gid,
				captcha: $("#captcha").val()
			}),
			headers: {
				"Content-Type": "application/json"
			}
		}, function(e, r, b) {
			console.log(e,b);
			if (r.statusCode == 200) {
				status.text("Account created successfully!");
				fetchAccountList();
			} else {
				status.text("Account creation failed");
			}
		});
	} else {
		status.text("Missing field values?");
	}
}

function ValidateAndStoreFields() {
	var account = {};
	// Basic data
	var f = "username login password email".split(" ");
	for (var i in f) {
		var v = $("#x-" + f[i] + "-o").text();
		if (!v.length) return false;
		account[f[i]] = v;
	}
	// Community
	account.community = $("#cb-community").prop("checked");
	if (account.community) {
		if ($("#cb-group").prop("checked")) {
			account.group = $("#group").val();
		}
		account.privacy = {
			profile: $("#privacy-profile").val(),
			comments: $("#privacy-comments").val()
		}
		if ($("#custom-url").val().length) {
			account.customURL = $("#custom-url").val();
		}
		if ($("#cb-avatar").prop("checked")) {
			account.avatar = $("#avatar").val();
		}
		if ($("#cb-summary").prop("checked")) {
			account.summary = $("#ta-summary").val();
		}
	}
	return account;
}

function StartSteam(username, password) {
	status.text("Starting steam!");
	request(SERVER + "steam/login/" + username + "/" + password, function() {});
}

function AutoGenerateFields() {
	var x = "username login password email".split(" ");
	for (var u in x) {
		var z = x[u];
		var v = $("#x-" + z + "-i").val();
		try {
			if ($("#x-" + z + "-c").prop("checked")) {
				v = new RandExp($("#x-" + z + "-x").val()).gen();
			}
		} catch (e) {}
		v = v.replace(/#+/g, function(match) { return pad(accountSequenceNumber, match.length); });
		$("#x-" + z + "-o").text(v);
	}
	$("#number").val(accountSequenceNumber);
}

$(() => {

console.log($("#table-user input"));

$("#table-user input").on("input", AutoGenerateFields);

$("#custom-url").on("input", function() {
	$(this).val($(this).val().replace(/[^a-z0-9_]/gi, ''));
});

$("#avatar").on("input", function() {
	$("#avatar-img").attr("src", $(this).val());
});

$("#number").on("input", function() {
	var nn = accountSequenceNumber;
	try {
		nn = parseInt($(this).val());
	} catch(e) {}	
	accountSequenceNumber = nn;
	AutoGenerateFields();
});

$("#captcha-img").on("click", function() {
	RefreshCaptcha();
});

$(window).bind("beforeunload", function() {
	localStorage.accounts = JSON.stringify(accounts);
});

$("#create").on("click", MakeAccount);
$("#custom-url-check").on("click", CheckCustomURL);
$("#next-account").on("click", function() {
	accountSequenceNumber++;
	RefreshCaptcha();
	AutoGenerateFields();
});
$("#list-refresh").on("click", fetchAccountList);
$("#list-prev").on("click", function() {
	var p = parseInt($("#list-page").val());
	if (isNaN(p) || !isFinite(p)) p = 0;
	if (p > 0) p--;
	$("#list-page").val(p)
	fetchAccountList();
});
$("#list-next").on("click", function() {	
	var p = parseInt($("#list-page").val());
	if (isNaN(p) || !isFinite(p)) p = 0;
	p++;
	$("#list-page").val(p)
	fetchAccountList();
});

status = $("#status");
$("#avatar-img").attr("src", $("#avatar").val());
RefreshCaptcha();
AutoGenerateFields();
fetchAccountList();
	
});