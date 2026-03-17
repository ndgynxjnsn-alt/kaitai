meta:
  id: tlv_message
  title: Simple TLV (Type-Length-Value) Protocol
  endian: be
seq:
  - id: magic
    contents: [0x54, 0x4C, 0x56, 0x31]
  - id: version
    type: u1
  - id: num_entries
    type: u2
  - id: entries
    type: entry
    repeat: expr
    repeat-expr: num_entries
types:
  entry:
    seq:
      - id: tag
        type: u1
      - id: length
        type: u2
      - id: value
        size: length