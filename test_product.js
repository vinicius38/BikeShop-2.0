fetch('http://localhost:3000/api/Products', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({
        "code": "PROD-999",
        "barcode": "",
        "name": "Test Product",
        "description": "",
        "categoryId": 1,
        "supplierId": null,
        "costPrice": 10,
        "salePrice": 20,
        "stockQuantity": 10,
        "minimumStockQuantity": 5,
        "unit": "UN"
    }) 
}).then(r=>r.json()).then(console.log)
