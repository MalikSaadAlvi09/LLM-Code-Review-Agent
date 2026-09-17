package reconciler

import "fmt"

type Transaction struct {
	ID     string
	Amount float64
}

func Reconcile(txs []Transaction) float64 {
	var total float64 = 0.0
	for _, tx := range txs {
		total += tx.Amount
	}
	fmt.Println("Total reconciled:", total)
	return total
}
