fetch('http://localhost:3000/api/Suppliers/5', { 
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({
        "corporateName":"Test Edited",
        "tradeName":"Test",
        "cnpj":"12.345.678/0001-99",
        "email":"test@test.com",
        "phone":"11999999999",
        "cellPhone":"11999999999",
        "contactPerson":"Test",
        "address":{
            "street":"Test",
            "number":"2",
            "complement":"",
            "neighborhood":"Test",
            "city":"Test",
            "state":"SP",
            "zipCode":"00000-000"
        }
    }) 
}).then(r=>r.json()).then(console.log)
