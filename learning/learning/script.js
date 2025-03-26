console.log("Hello World");
let x = 30;
let str = "Hello";
let bool = true;
let letters = ['a', 'b', 'c'];

console.log(fruits[0]);

let vector3 = {
    x:5,
    y:3,
    z:7,
    magnitude:function(){
        return Math.sqrt(this.x**2 + this.y **2 + this.z ** 2);
    },
    normalized:function(){
        let m = this.magnitude();
        return [this.x / m, this.y / m, this.z / m];
    }
}