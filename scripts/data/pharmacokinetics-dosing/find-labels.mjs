// Lists the openFDA drug labels (CC0) matching each search, to pick the set ids that
// `fetch-labels.mjs` reads. Usage: node scripts/data/pharmacokinetics-dosing/find-labels.mjs 'openfda.brand_name:"LANOXIN"' …
for (const q of process.argv.slice(2)) {
	const r = await fetch(`https://api.fda.gov/drug/label.json?search=${q}&limit=10`);
	const d = await r.json();
	console.log('==', q, d.meta?.results?.total ?? d.error?.message);
	for (const x of d.results ?? [])
		console.log(
			'  ',
			x.set_id,
			x.effective_time,
			(x.openfda.brand_name || []).join('/'),
			(x.openfda.route || []).join('/'),
			(x.openfda.manufacturer_name || []).join('/'),
			(x.openfda.dosage_form || []).join('/')
		);
}
