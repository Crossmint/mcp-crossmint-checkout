const options = {
    method: 'POST',
    headers: {
      'X-API-KEY': 'sk_staging_5qJURKJnsGMYPxX6swLdiEeXuhiRNfooy311q8RnM2XB4SyrdkhUh7D7SpnLnt3fgZhYMUNQ89yz71tkcVo4VW5VJyE5u2UKnEuyCLZxRCe844sdM5VVHf3JbnbhEZwJjfuySt8Tg7fJ3GkcvL3Tzxsi21Jycx4rtJRLhCxx3GyfUHgdgwHBieoK9hNasQsJw1aR6ybkhwtB2z9Ep4hEYVR4',
      origin: '<origin>',
      'Content-Type': 'application/json'
    },
    body: '{"locale":"en-US","payment":{"method":"ethereum-sepolia","currency":"credit","receiptEmail":"filippos.lympe@gmail.com","payerAddress":"0xeB2FFff66761cc4aA45C22369ece984ec5AaB819"},"lineItems":{"productLocator":"amazon:B00O79SKV6"},"recipient":{"email":"filippos.lympe@gmail.com","physicalAddress":{"name":"Filippos L","line1":"14 Murray Street","city":"New York City","postalCode":"10007","country":"US","state":"NY"}}}'
  };
  
  fetch('https://staging.crossmint.com/api/2022-06-09/orders', options)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));