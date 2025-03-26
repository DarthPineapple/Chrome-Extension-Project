#include <iostream>
using namespace std;

void sieveOfEratosthenes(int limit) {
    bool* primes = new bool[limit + 1];
    
    // Initialize all as true, except for 0 and 1 which are false
    memset(primes, true, sizeof(bool) * (limit + 1));
    primes[0] = primes[1] = false;
    
    int p = 2;
    while(p * p <= limit){
        if(primes[p]){
            for(int i = p * p; i <= limit; i += p)
                primes[i] = false;
        }
        p++;
    }

    // Print all prime numbers
    cout << "Prime numbers up to " << limit << ": ";
    for(int i = 2; i <= limit; i++)
        if(primes[i])
            cout << i << " ";

    delete[] primes;
}

int main() {
    int limit;
    cout << "Enter a number: ";
    cin >> limit;

    sieveOfEratosthenes(limit);

    return 0;
}