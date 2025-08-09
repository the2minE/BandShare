;; BandToken Contract
;; Clarity v2
;; Implements fungible token functionality for BandShare bandwidth sharing platform
;; Features: mint, burn, transfer, allowance, staking, admin controls, and event logging

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INSUFFICIENT-STAKE u102)
(define-constant ERR-MAX-SUPPLY-REACHED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INSUFFICIENT-ALLOWANCE u106)
(define-constant ERR-INVALID-AMOUNT u107)

;; Token metadata
(define-constant TOKEN-NAME "BandToken")
(define-constant TOKEN-SYMBOL "BAND")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000) ;; 1B tokens (decimals accounted separately)

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-supply uint u0)

;; Balances, stakes, and allowances
(define-map balances principal uint)
(define-map staked-balances principal uint)
(define-map allowances { owner: principal, spender: principal } uint)

;; Event definitions for transparency
(define-data-var last-event-id uint u0)
(define-map events { event-id: uint } { action: (string-ascii 32), initiator: principal, recipient: principal, amount: uint, timestamp: uint })

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: log event
(define-private (log-event (action (string-ascii 32)) (recipient principal) (amount uint))
  (let ((event-id (+ (var-get last-event-id) u1)))
    (map-set events { event-id: event-id }
      { action: action, initiator: tx-sender, recipient: recipient, amount: amount, timestamp: block-height })
    (var-set last-event-id event-id)
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "transfer-admin" new-admin u0))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (try! (log-event (if pause "pause" "unpause") tx-sender u0))
    (var-set paused pause)
    (ok pause)
  )
)

;; Mint new tokens
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((new-supply (+ (var-get total-supply) amount)))
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (var-set total-supply new-supply)
      (try! (log-event "mint" recipient amount))
      (ok true)
    )
  )
)

;; Burn tokens
(define-public (burn (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (var-set total-supply (- (var-get total-supply) amount))
      (try! (log-event "burn" tx-sender amount))
      (ok true)
    )
  )
)

;; Transfer tokens
(define-public (transfer (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((sender-balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (try! (log-event "transfer" recipient amount))
      (ok true)
    )
  )
)

;; Approve allowance for delegated spending
(define-public (approve (spender principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq spender 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (map-set allowances { owner: tx-sender, spender: spender } amount)
    (try! (log-event "approve" spender amount))
    (ok true)
  )
)

;; Transfer tokens on behalf of another user
(define-public (transfer-from (owner principal) (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((allowance (default-to u0 (map-get? allowances { owner: owner, spender: tx-sender })))
          (owner-balance (default-to u0 (map-get? balances owner))))
      (asserts! (>= allowance amount) (err ERR-INSUFFICIENT-ALLOWANCE))
      (asserts! (>= owner-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set allowances { owner: owner, spender: tx-sender } (- allowance amount))
      (map-set balances owner (- owner-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (try! (log-event "transfer-from" recipient amount))
      (ok true)
    )
  )
)

;; Stake tokens for governance or rewards
(define-public (stake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (map-set staked-balances tx-sender (+ amount (default-to u0 (map-get? staked-balances tx-sender))))
      (try! (log-event "stake" tx-sender amount))
      (ok true)
    )
  )
)

;; Unstake tokens
(define-public (unstake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((stake-balance (default-to u0 (map-get? staked-balances tx-sender))))
      (asserts! (>= stake-balance amount) (err ERR-INSUFFICIENT-STAKE))
      (map-set staked-balances tx-sender (- stake-balance amount))
      (map-set balances tx-sender (+ amount (default-to u0 (map-get? balances tx-sender))))
      (try! (log-event "unstake" tx-sender amount))
      (ok true)
    )
  )
)

;; Read-only: get balance
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

;; Read-only: get staked balance
(define-read-only (get-staked-balance (account principal))
  (ok (default-to u0 (map-get? staked-balances account)))
)

;; Read-only: get allowance
(define-read-only (get-allowance (owner principal) (spender principal))
  (ok (default-to u0 (map-get? allowances { owner: owner, spender: spender })))
)

;; Read-only: get total supply
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get token metadata
(define-read-only (get-token-metadata)
  (ok {
    name: TOKEN-NAME,
    symbol: TOKEN-SYMBOL,
    decimals: TOKEN-DECIMALS,
    max-supply: MAX-SUPPLY
  })
)

;; Read-only: get event by ID
(define-read-only (get-event (event-id uint))
  (ok (default-to { action: "", initiator: 'SP000000000000000000002Q6VF78, recipient: 'SP000000000000000000002Q6VF78, amount: u0, timestamp: u0 }
              (map-get? events { event-id: event-id })))
)