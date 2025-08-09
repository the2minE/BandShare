;; Reputation System Contract
;; Clarity v2
;; Manages reputation scores for Providers and Consumers in BandShare
;; Features: score updates, decay, validation, and event logging

(define-constant ERR-NOT-AUTHORIZED u300)
(define-constant ERR-INVALID-SCORE u301)
(define-constant ERR-PAUSED u302)
(define-constant ERR-ZERO-ADDRESS u303)
(define-constant ERR-MARKETPLACE-NOT-SET u304)

;; Constants
(define-constant MAX-SCORE u100) ;; Maximum reputation score
(define-constant MIN-SCORE u0) ;; Minimum reputation score
(define-constant DECAY-RATE u5) ;; Score decay per period (e.g., per 1000 blocks)
(define-constant DECAY-PERIOD u1000) ;; Blocks per decay cycle

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var marketplace-contract principal 'SP000000000000000000002Q6VF78) ;; BandwidthMarketplace contract address
(define-data-var last-decay-block uint u0)

;; Data maps
(define-map provider-reputation principal { score: uint, last-updated: uint })
(define-map consumer-reputation principal { score: uint, last-updated: uint })

;; Event logging
(define-data-var last-event-id uint u0)
(define-map events { event-id: uint } { action: (string-ascii 32), initiator: principal, user: principal, score: uint, timestamp: uint })

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
(define-private (log-event (action (string-ascii 32)) (user principal) (score uint))
  (let ((event-id (+ (var-get last-event-id) u1)))
    (map-set events { event-id: event-id }
      { action: action, initiator: tx-sender, user: user, score: score, timestamp: block-height })
    (var-set last-event-id event-id)
    (ok true)
  )
)

;; Private helper: apply decay
(define-private (apply-decay (score uint) (last-updated uint))
  (let ((blocks-passed (- block-height last-updated))
        (decay-cycles (/ blocks-passed DECAY-PERIOD)))
    (if (> decay-cycles u0)
        (if (<= score (* decay-cycles DECAY-RATE))
            MIN-SCORE
            (- score (* decay-cycles DECAY-RATE)))
        score)
  )
)

;; Set marketplace contract address
(define-public (set-marketplace-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (try! (log-event "set-marketplace-contract" contract u0))
    (var-set marketplace-contract contract)
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

;; Update provider reputation
(define-public (update-provider-reputation (provider principal) (score uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-marketplace) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq provider 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (and (>= score MIN-SCORE) (<= score MAX-SCORE)) (err ERR-INVALID-SCORE))
    (let ((current-rep (default-to { score: u50, last-updated: u0 } (map-get? provider-reputation provider)))
          (decayed-score (apply-decay (get score current-rep) (get last-updated current-rep))))
      (map-set provider-reputation provider { score: (/ (+ decayed-score score) u2), last-updated: block-height })
      (try! (log-event "update-provider-reputation" provider score))
      (ok true)
    )
  )
)

;; Update consumer reputation
(define-public (update-consumer-reputation (consumer principal) (score uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-marketplace) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq consumer 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (and (>= score MIN-SCORE) (<= score MAX-SCORE)) (err ERR-INVALID-SCORE))
    (let ((current-rep (default-to { score: u50, last-updated: u0 } (map-get? consumer-reputation consumer)))
          (decayed-score (apply-decay (get score current-rep) (get last-updated current-rep))))
      (map-set consumer-reputation consumer { score: (/ (+ decayed-score score) u2), last-updated: block-height })
      (try! (log-event "update-consumer-reputation" consumer score))
      (ok true)
    )
  )
)

;; Trigger global reputation decay
(define-public (trigger-decay)
  (begin
    (asserts! (> block-height (+ (var-get last-decay-block) DECAY-PERIOD)) (err ERR-NOT-AUTHORIZED))
    (var-set last-decay-block block-height)
    (try! (log-event "trigger-decay" tx-sender u0))
    (ok true)
  )
)

;; Read-only: get provider reputation
(define-read-only (get-provider-reputation (provider principal))
  (let ((rep (default-to { score: u50, last-updated: u0 } (map-get? provider-reputation provider))))
    (ok { score: (apply-decay (get score rep) (get last-updated rep)), last-updated: (get last-updated rep) })
  )
)

;; Read-only: get consumer reputation
(define-read-only (get-consumer-reputation (consumer principal))
  (let ((rep (default-to { score: u50, last-updated: u0 } (map-get? consumer-reputation consumer))))
    (ok { score: (apply-decay (get score rep) (get last-updated rep)), last-updated: (get last-updated rep) })
  )
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
  (ok (default-to { action: "", initiator: 'SP000000000000000000002Q6VF78, user: 'SP000000000000000000002Q6VF78, score: u0, timestamp: u0 }
              (map-get? events { event-id: event-id })))
)