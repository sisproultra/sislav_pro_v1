import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/correlativos/obtener-siguiente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'dc03ce85-58e4-40dc-b4f1-7a61bf8c4e96',
        targetType: '03',
        targetSerie: 'B001'
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
