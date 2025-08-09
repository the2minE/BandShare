;; Access Control Contract
;; Clarity v2
;; Manages access permissions for BandShare bandwidth sharing
;; Features: grant, revoke, validate access, and event logging

(define-constant ERR-NOT-AUTHORIZED u400)
(define-constant ERR-PAUSED u401)
(define-constant ERR-ZERO-ADDRESS u402)
(define-constant ERR-MARKETPLACE-NOT-SET u403)
(define-constant ERR-ALREADY-GRANTED u404)
(define-constant ERR-ACCESS-NOT-FOUND u405)

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var marketplace-contract principal 'SP000000000000000000002Q6VF78) ;; BandwidthMarketplace contract address

;; Data maps
(define-map access-permissions { consumer: principal, provider: principal } { granted: bool, timestamp: uint })
(define-map consumer-access principal (list 100 principal))

;; Event logging
(define-data-var last-event-id uint u0)
(define-map events { event-id: uint } { action: (string-ascii 32), initiator: principal, consumer: principal, provider: principal, timestamp: uint })

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: is-marketplace
(define-private (is-marketplace)
  (is-eq tx-sender (var-get marketplace-contract))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: log event
(define-private (log-event (action (string-ascii 32)) (consumer principal) (provider principal))
  (let ((event-id (+ (var-get last-event-id) u1)))
    (map-set events { event-id: event-id }
      { action: action, initiator: tx-sender, consumer: consumer, provider: provider, timestamp: block-height })
    (var-set last-event-id event-id)
    (ok true)
  )
)

;; Set marketplace contract address
(define-public (set-marketplace-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "set-marketplace-contract" contract contract))
    (var-set marketplace-contract contract)
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "transfer-admin" new-admin new-admin))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (try! (log-event (if pause "pause" "unpause") tx-sender tx-sender))
    (var-set paused pause)
    (ok pause)
  )
)

;; Grant access
(define-public (grant-access (consumer principal) (provider principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-marketplace) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq consumer 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (not (is-eq provider 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (not (get granted (default-to { granted: false, timestamp: u0 } (map-get? access-permissions { consumer: consumer, provider: provider })))) (err ERR-ALREADY-GRANTED))
    (let ((current-access (default-to (list ) (map-get? consumer-access consumer))))
      (map-set access-permissions { consumer: consumer, provider: provider } { granted: true, timestamp: block-height })
      (map-set consumer-access consumer (unwrap! (as-max-len? (append current-access provider) u100) (err ERR-INVALID-AMOUNT)))
      (try! (log-event "grant-access" consumer provider))
      (ok true)
    )
  )
)

;; Revoke access
(define-public (revoke-access (consumer principal) (provider principal))
  (begin
    (ensure-not-paused)
    (asserts! (or (is-admin) (is-marketplace)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq consumer 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (not (is-eq provider 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (let ((permission (default-to { granted: false, timestamp: u0 } (map-get? access-permissions { consumer: consumer, provider: provider }))))
      (asserts! (get granted permission) (err ERR-ACCESS-NOT-FOUND))
      (map-set access-permissions { consumer: consumer, provider: provider } { granted: false, timestamp: (get timestamp permission) })
      (try! (log-event "revoke-access" consumer provider))
      (ok true)
    )
  )
)

;; Read-only: check access
(define-read-only (has-access (consumer principal) (provider principal))
  (ok (get granted (default-to { granted: false, timestamp: u0 } (map-get? access-permissions { consumer: consumer, provider: provider }))))
)

;; Read-only: get consumer access list
(define-read-only (get-consumer-access (consumer principal))
  (ok (default-to (list ) (map-get? consumer-access consumer)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get marketplace contract
(define-read-only (get-marketplace-contract)
  (ok (var-get marketplace-contract))
)

;; Read-only: get event
(define-read-only (get-event (event-id uint))
  (ok (default-to { action: "", initiator: 'SP000000000000000000002Q6VF78, consumer: 'SP000000000000000000002Q6VF78, provider: 'SP000000000000000000002Q6VF78, timestamp: u0 }
              (map-get? events { event-id: event-id })))
)