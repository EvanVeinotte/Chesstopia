let testarray = [[3,"stinky1"],[1, "yoink"],[106, "shawty"],[22, "yaaaaw"]]

testarray.splice(2, 1)
testarray.sort(function(a, b){return a[0] - b[0]});
console.log(testarray)