// Prints the sentences of US prescribing information (openFDA drug label API, CC0 1.0,
// https://open.fda.gov/apis/drug/label/) that state the numbers `drugs.ts` uses: half-life,
// volume of distribution, clearance, bioavailability, absorption and the target range. The
// numbers are copied into `src/routes/pharmacokinetics-dosing/drugs.ts` by hand, with the set id
// and version of the label they come from; this script lets anyone re-read them.
//
// Usage: node scripts/data/pharmacokinetics-dosing/fetch-labels.mjs [set_id …]
//        (with no argument, the labels `drugs.ts` cites)
const CITED = {
	'd91e3646-4c63-4512-ab22-db39c085c4dc': 'digoxin (Lanoxin tablets)',
	'86dd27d1-9cee-48ae-b55d-e2d2f7dbc593': 'phenytoin (Dilantin extended capsules)',
	'04518b80-7563-4544-bf05-04f286223faa': 'lithium carbonate',
	'25eabefa-518b-4030-9b72-01ac8b3deba9': 'theophylline',
	'9a663ef3-881f-48bd-2689-3713b24545c2': 'aminophylline (IV theophylline)',
	'0576803d-95de-4a48-806a-69ae3fcaf6b0': 'vancomycin (IV)'
};

const KEY =
	/half-life|half life|volume of distribution|clearance|bioavailab|absorb|peak|therapeutic (range|serum|concentration)|serum (level|concentration)s? (of|between)|mcg\/mL|mEq\/L|ng\/mL|saturab|Michaelis|L\/kg|mL\/min/i;
const SECTIONS = [
	'clinical_pharmacology',
	'pharmacokinetics',
	'dosage_and_administration',
	'warnings',
	'overdosage',
	'precautions'
];

const ids = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(CITED);
for (const id of ids) {
	const r = await fetch(`https://api.fda.gov/drug/label.json?search=set_id:"${id}"`);
	const d = await r.json();
	const x = d.results?.[0];
	if (!x) {
		console.log('!! not found', id);
		continue;
	}
	console.log(`\n==== ${CITED[id] ?? ''} ${id} version ${x.version} effective ${x.effective_time}`);
	console.log(
		'     ',
		(x.openfda.brand_name || []).join('/'),
		(x.openfda.manufacturer_name || []).join('/')
	);
	for (const s of SECTIONS) {
		for (const text of x[s] ?? []) {
			const sentences = text.split(/(?<=[.;])\s+(?=[A-Z(])/);
			const hits = sentences.filter((z) => KEY.test(z));
			if (hits.length) console.log(`  -- ${s}`);
			for (const h of hits) console.log('   •', h.trim());
		}
	}
}
