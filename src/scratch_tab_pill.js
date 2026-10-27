const fs = require('fs');
const code = fs.readFileSync('corbel/assets/index-CPU6Hf-a.js', 'utf8');

// Find zo, Bo, Uo, fo, Go
const foIdx = code.indexOf('function fo(');
console.log('--- fo function ---');
console.log(code.substring(foIdx, foIdx + 1200));

const uoIdx = code.indexOf('function Uo(');
console.log('--- Uo function ---');
console.log(code.substring(uoIdx, uoIdx + 400));

const goIdx = code.indexOf('function Go(');
console.log('--- Go function ---');
console.log(code.substring(goIdx, goIdx + 600));
