import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('community-contexts.json', 'utf8'));

let noEventsCount = 0;
let neverHadEventsCount = 0;

const hits = [];

for (const d of data) {
  if (!d.scraped_text) continue;
  const lower = d.scraped_text.toLowerCase();
  
  if (lower.includes('no upcoming events')) {
    noEventsCount++;
    if (!lower.includes('past events')) {
      neverHadEventsCount++;
      hits.push({ id: d.id, title: d.title });
    }
  }
}
console.log('No upcoming events count:', noEventsCount);
console.log('No upcoming events AND NO past events count:', neverHadEventsCount);
console.log('Sample victims:', hits.slice(0, 10));

fs.writeFileSync('dead-communities.json', JSON.stringify(hits, null, 2));

