let fs = require('fs');

let sourc = fs.readFileSync(process.argv[2]).toString().split('\n');
let desti = JSON.parse(fs.readFileSync(process.argv[3]).toString());
fs.writeFileSync(process.argv[3] + '.bak', JSON.stringify(desti));

let count = 0;

for (let i of sourc)
{
    let x = /(\d+) (\d+) (\w+) (\w+) (\d+)/g.exec(i);
    if (!x) continue;
    ++count;
    desti.array.push({ login: x[3], password: x[4] });
}
console.log('recycled', count, 'accs');


fs.writeFileSync(process.argv[3], JSON.stringify(desti));

