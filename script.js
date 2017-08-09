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
	var password = tr.find(":nth-child(3)").attr("data-pwd");
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
	var passwd = $("<td></td>").attr("data-pwd", acc.password).text("< HIDDEN >").attr("data-shown", "0");
	passwd.on("click", function() {
		var t = $(this);
		if (t.attr("data-shown") == "1") return;
		t.attr("data-shown", "1");
		t.text(t.attr("data-pwd"));
		setTimeout(function() {
			t.attr("data-shown", "0");
			t.text("< HIDDEN >");
		}, 5000);
	});
	tr.append(passwd);
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

function MakeAccount() {
	var acc = ValidateAndStoreFields();
	if (acc) {
		status.text("Creating account");
		request.post({
			url: SERVER + "create", 
			body: JSON.stringify(acc),
			headers: {
				"Content-Type": "application/json"
			}
		}, function(e, r, b) {
			console.log(e,b);
			if (r.statusCode == 200) {
				status.text("Account created successfully!");
				fetchAccountList();
				accountSequenceNumber++;
				AutoGenerateFields();
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
		if ($("#cb-summary").prop("checked") && $("#ta-summary").val().length) {
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

function fetchCGStatus() {
	request(SERVER + "cg/status", function(e, r, b) {
		if (e) {
			$("#cg-active").text("broken").attr("class", "bad-text");
			console.log(e);
			return;	
		}
		var data = JSON.parse(b);
		$("#cg-active").text(data.active ? "enabled" : "disabled").attr("class", data.active ? "good-text" : "bad-text");
		$("#cg-count").text(data.accounts.count);
	});
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

$(window).bind("beforeunload", function() {
	localStorage.accounts = JSON.stringify(accounts);
});

$("#create").on("click", MakeAccount);
$("#custom-url-check").on("click", CheckCustomURL);
$("#next-account").on("click", function() {
	accountSequenceNumber++;
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

$("#cg-start").on("click", function() {
	request(SERVER + "cg/start", function() {
		fetchCGStatus();
	});
});
$("#cg-stop").on("click", function() {
	request(SERVER + "cg/stop", function() {
		fetchCGStatus();
	});
});
$("#cg-refresh").on("click", fetchCGStatus);
$("#cg-pop").on("click", function() {
	request(SERVER + "cg/pop", function(e, r, b) {
		fetchCGStatus();
		if (e) {
			console.log(e);
			return;
		}
		var data = JSON.parse(b);
		$("#cg-acc-login").text(data.account.login);
		$("#cg-acc-password").text(data.account.password);
		$("#cg-acc-profile").html($("<a></a>").attr("href", "https://steamcommunity.com/profiles/" + data.account.steamID).text("Link"));
		$("#cg-popped-account").removeClass("hidden");
	});
});
$("#cg-login").on("click", function() {
	var username = $("#cg-acc-login").text();
	var password = $("#cg-acc-password").text();
	StartSteam(username, password);
});

status = $("#status");
$("#avatar-img").attr("src", $("#avatar").val());
// Update CG status every 30 seconds
setInterval(fetchCGStatus, 30 * 1000);
fetchCGStatus();
AutoGenerateFields();
fetchAccountList();
	
});