;; Bandwidth Marketplace Contract
;; Clarity v2
;; Manages bandwidth sharing marketplace for BandShare platform
;; Features: offer, consume, cancel bandwidth, rate calculation, and event logging

(define-constant ERR-NOT-AUTHORIZED u200)
(define-constant ERR-INSUFFICIENT-BANDWIDTH u201)
(define-constant ERR-INVALID-AMOUNT u202)
(define-constant ERR-PAUSED u203)
(define-constant ERR-ZERO-ADDRESS u204)
(define-constant ERR-CONTRACT-NOT-SET u205)
(define-constant ERR-ALREADY-OFFERED u206)
(define-constant ERR-OFFER-NOT-FOUND u207)

;; Constants
(define-constant RATE-PER-MB u1000000) ;; 1 BAND per MB (6 decimals)
(define-constant MIN-BANDWIDTH u100) ;; Minimum bandwidth offer (in MB)

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var token-contract principal 'SP000000000000000000002Q6VF78) ;; BandToken contract address
(define-data-var access-control-contract principal 'SP000000000000000000002Q6VF78) ;; AccessControl contract address

;; Data maps
(define-map offers { provider: principal, offer-id: uint } { amount: uint, active: bool })
(define-map provider-offers principal (list 100 uint))
(define-map consumptions { consumer: principal, provider: principal, offer-id: uint } { amount: uint, timestamp: uint })

;; Event logging
(define-data-var last-event-id uint u0)
(define-map events { event-id: uint } { action: (string-ascii 32), initiator: principal, provider: principal, offer-id: uint, amount: uint, timestamp: uint })

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: log event
(define-private (log-event (action (string-ascii 32)) (provider principal) (offer-id uint) (amount uint))
  (let ((event-id (+ (var-get last-event-id) u1)))
    (map-set events { event-id: event-id }
      { action: action, initiator: tx-sender, provider: provider, offer-id: offer-id, amount: amount, timestamp: block-height })
    (var-set last-event-id event-id)
    (ok true)
  )
)

;; Set token contract address
(define-public (set-token-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set token-contract contract)
    (try! (log-event "set-token-contract" contract u0 u0))
    (ok true)
  )
)

;; Set access control contract address
(define-public (set-access-control-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set access-control-contract contract)
    (try! (log-event "set-access-control" contract u0 u0))
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "transfer-admin" new-admin u0 u0))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (try! (log-event (if pause "pause" "unpause") tx-sender u0 u0))
    (var-set paused pause)
    (ok pause)
  )
)

;; Offer bandwidth
(define-public (offer-bandwidth (amount uint) (offer-id uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount MIN-BANDWIDTH) (err ERR-INVALID-AMOUNT))
    (asserts! (is-none (map-get? offers { provider: tx-sender, offer-id: offer-id })) (err ERR-ALREADY-OFFERED))
    (let ((current-offers (default-to (list ) (map-get? provider-offers tx-sender))))
      (map-set offers { provider: tx-sender, offer-id: offer-id } { amount: amount, active: true })
      (map-set provider-offers tx-sender (unwrap! (as-max-len? (append current-offers offer-id) u100) (err ERR-INVALID-AMOUNT)))
      (try! (log-event "offer-bandwidth" tx-sender offer-id amount))
      (ok true)
    )
  )
)

;; Cancel bandwidth offer
(define-public (cancel-offer (offer-id uint))
  (begin
    (ensure-not-paused)
    (let ((offer (unwrap! (map-get? offers { provider: tx-sender, offer-id: offer-id }) (err ERR-OFFER-NOT-FOUND))))
      (asserts! (get active offer) (err ERR-OFFER-NOT-FOUND))
      (map-set offers { provider: tx-sender, offer-id: offer-id } { amount: (get amount offer), active: false })
      (try! (log-event "cancel-offer" tx-sender offer-id (get amount offer)))
      (ok true)
    )
  )
)

;; Consume bandwidth
(define-public (consume-bandwidth (provider principal) (offer-id uint) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq provider 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq (var-get token-contract) 'SP000000000000000000002Q6VF78)) (err ERR-CONTRACT-NOT-SET))
    (asserts! (not (is-eq (var-get access-control-contract) 'SP000000000000000000002Q6VF78)) (err ERR-CONTRACT-NOT-SET))
    (let ((offer (unwrap! (map-get? offers { provider: provider, offer-id: offer-id }) (err ERR-OFFER-NOT-FOUND))))
      (asserts! (get active offer) (err ERR-OFFER-NOT-FOUND))
      (asserts! (>= (get amount offer) amount) (err ERR-INSUFFICIENT-BANDWIDTH))
      (let ((cost (* amount RATE-PER-MB)))
        (try! (contract-call? (var-get token-contract) transfer-from tx-sender provider cost))
        (map-set offers { provider: provider, offer-id: offer-id } { amount: (- (get amount offer) amount), active: (get active offer) })
        (map-set consumptions { consumer: tx-sender, provider: provider, offer-id: offer-id } { amount: amount, timestamp: block-height })
        (try! (contract-call? (var-get access-control-contract) grant-access tx-sender provider))
        (try! (log-event "consume-bandwidth" provider offer-id amount))
        (ok true)
      )
    )
  )
)

;; Read-only: get offer
(define-read-only (get-offer (provider principal) (offer-id uint))
  (ok (default-to { amount: u0, active: false } (map-get? offers { provider: provider, offer-id: offer-id })))
)

;; Read-only: get provider offers
(define-read-only (get-provider-offers (provider principal))
  (ok (default-to (list ) (map-get? provider-offers provider)))
)

;; Read-only: get consumption
(define-read-only (get-consumption (consumer principal) (provider principal) (offer-id uint))
  (ok (default-to { amount: u0, timestamp: u0 } (map-get? consumptions { consumer: consumer, provider: provider, offer-id: offer-id })))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get token contract
(define-read-only (get-token-contract)
  (ok (var-get token-contract))
)

;; Read-only: get access control contract
(define-read-only (get-access-control-contract)
  (ok (var-get access-control-contract))
)

;; Read-only: get event
(define-read-only (get-event (event-id uint))
  (ok (default-to { action: "", initiator: 'SP000000000000000000002Q6VF78, provider: 'SP000000000000000000002Q6VF78, offer-id: u0, amount: u0, timestamp: u0 }
              (map-get? events { event-id: event-id })))
)