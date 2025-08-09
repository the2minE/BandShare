;; Dispute Resolution Contract
;; Clarity v2
;; Manages disputes for BandShare bandwidth sharing
;; Features: create, resolve, vote on disputes, and event logging

(define-constant ERR-NOT-AUTHORIZED u500)
(define-constant ERR-PAUSED u501)
(define-constant ERR-ZERO-ADDRESS u502)
(define-constant ERR-MARKETPLACE-NOT-SET u503)
(define-constant ERR-INVALID-DISPUTE u504)
(define-constant ERR-ALREADY-VOTED u505)
(define-constant ERR-DISPUTE-RESOLVED u506)
(define-constant ERR-VOTING-CLOSED u507)

;; Constants
(define-constant VOTING-PERIOD u1440) ;; ~1 day in blocks (10 min/block)
(define-constant MIN-VOTES u3) ;; Minimum votes to resolve

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var marketplace-contract principal 'SP000000000000000000002Q6VF78) ;; BandwidthMarketplace contract address
(define-data-var token-contract principal 'SP000000000000000000002Q6VF78) ;; BandToken contract address

;; Data maps
(define-map disputes { dispute-id: uint } { consumer: principal, provider: principal, description: (string-ascii 256), created-at: uint, resolved: bool, resolution: (optional (string-ascii 256)), votes-for-consumer: uint, votes-for-provider: uint })
(define-map votes { dispute-id: uint, voter: principal } { voted-for-consumer: bool })
(define-data-var dispute-counter uint u0)

;; Event logging
(define-data-var last-event-id uint u0)
(define-map events { event-id: uint } { action: (string-ascii 32), initiator: principal, dispute-id: uint, consumer: principal, provider: principal, timestamp: uint })

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
(define-private (log-event (action (string-ascii 32)) (dispute-id uint) (consumer principal) (provider principal))
  (let ((event-id (+ (var-get last-event-id) u1)))
    (map-set events { event-id: event-id }
      { action: action, initiator: tx-sender, dispute-id: dispute-id, consumer: consumer, provider: provider, timestamp: block-height })
    (var-set last-event-id event-id)
    (ok true)
  )
)

;; Set marketplace contract address
(define-public (set-marketplace-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "set-marketplace-contract" u0 contract contract))
    (var-set marketplace-contract contract)
    (ok true)
  )
)

;; Set token contract address
(define-public (set-token-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "set-token-contract" u0 contract contract))
    (var-set token-contract contract)
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "transfer-admin" u0 new-admin new-admin))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (try! (log-event (if pause "pause" "unpause") u0 tx-sender tx-sender))
    (var-set paused pause)
    (ok pause)
  )
)

;; Create dispute
(define-public (create-dispute (provider principal) (description (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (asserts! (is-marketplace) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq provider 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (not (is-eq tx-sender 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> (len description) u0) (err ERR-INVALID-DISPUTE))
    (let ((dispute-id (+ (var-get dispute-counter) u1)))
      (map-set disputes { dispute-id: dispute-id }
        { consumer: tx-sender, provider: provider, description: description, created-at: block-height, resolved: false, resolution: none, votes-for-consumer: u0, votes-for-provider: u0 })
      (var-set dispute-counter dispute-id)
      (try! (log-event "create-dispute" dispute-id tx-sender provider))
      (ok dispute-id)
    )
  )
)

;; Vote on dispute
(define-public (vote-dispute (dispute-id uint) (vote-for-consumer bool))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq (var-get token-contract) 'SP000000000000000000002Q6VF78)) (err ERR-MARKETPLACE-NOT-SET))
    (let ((dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-INVALID-DISPUTE))))
      (asserts! (not (get resolved dispute)) (err ERR-DISPUTE-RESOLVED))
      (asserts! (< (- block-height (get created-at dispute)) VOTING-PERIOD) (err ERR-VOTING-CLOSED))
      (asserts! (is-none (map-get? votes { dispute-id: dispute-id, voter: tx-sender })) (err ERR-ALREADY-VOTED))
      (try! (contract-call? (var-get token-contract) get-staked-balance tx-sender))
      (map-set votes { dispute-id: dispute-id, voter: tx-sender } { voted-for-consumer: vote-for-consumer })
      (map-set disputes { dispute-id: dispute-id }
        { consumer: (get consumer dispute),
          provider: (get provider dispute),
          description: (get description dispute),
          created-at: (get created-at dispute),
          resolved: (get resolved dispute),
          resolution: (get resolution dispute),
          votes-for-consumer: (if vote-for-consumer (+ (get votes-for-consumer dispute) u1) (get votes-for-consumer dispute)),
          votes-for-provider: (if vote-for-consumer (get votes-for-provider dispute) (+ (get votes-for-provider dispute) u1)) })
      (try! (log-event "vote-dispute" dispute-id (get consumer dispute) (get provider dispute)))
      (ok true)
    )
  )
)

;; Resolve dispute
(define-public (resolve-dispute (dispute-id uint) (resolution (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (let ((dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-INVALID-DISPUTE))))
      (asserts! (not (get resolved dispute)) (err ERR-DISPUTE-RESOLVED))
      (asserts! (or (>= (get votes-for-consumer dispute) MIN-VOTES) (>= (get votes-for-provider dispute) MIN-VOTES)) (err ERR-INVALID-DISPUTE))
      (map-set disputes { dispute-id: dispute-id }
        { consumer: (get consumer dispute),
          provider: (get provider dispute),
          description: (get description dispute),
          created-at: (get created-at dispute),
          resolved: true,
          resolution: (some resolution),
          votes-for-consumer: (get votes-for-consumer dispute),
          votes-for-provider: (get votes-for-provider dispute) })
      (try! (log-event "resolve-dispute" dispute-id (get consumer dispute) (get provider dispute)))
      (ok true)
    )
  )
)

;; Read-only: get dispute
(define-read-only (get-dispute (dispute-id uint))
  (ok (default-to { consumer: 'SP000000000000000000002Q6VF78, provider: 'SP000000000000000000002Q6VF78, description: "", created-at: u0, resolved: false, resolution: none, votes-for-consumer: u0, votes-for-provider: u0 }
              (map-get? disputes { dispute-id: dispute-id })))
)

;; Read-only: get vote
(define-read-only (get-vote (dispute-id uint) (voter principal))
  (ok (default-to { voted-for-consumer: false } (map-get? votes { dispute-id: dispute-id, voter: voter })))
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

;; Read-only: get token contract
(define-read-only (get-token-contract)
  (ok (var-get token-contract))
)

;; Read-only: get event
(define-read-only (get-event (event-id uint))
  (ok (default-to { action: "", initiator: 'SP000000000000000000002Q6VF78, dispute-id: u0, consumer: 'SP000000000000000000002Q6VF78, provider: 'SP000000000000000000002Q6VF78, timestamp: u0 }
              (map-get? events { event-id: event-id })))
)