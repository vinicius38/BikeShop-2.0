fetch('http://localhost:3000/api/Products', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({"code":"TEST3","name":"Test Prod 3","categoryId":1,"costPrice":10,"salePrice":20,"initialStock":20,"stockQuantity":20,"minimumStockQuantity":5,"unit":"UN"}) 
}).then(r => r.json()).then(j => console.log(j));
