meta:
  id: tlv_message
  title: Simple TLV (Type-Length-Value) Protocol
  endian: be
doc: |
  A simple Type-Length-Value message format.
  Each message has a magic header, version, and a sequence of TLV entries.
seq:
  - id: magic
    contents: [0x54, 0x4C, 0x56, 0x31]  # "TLV1"
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
        enum: tag_type
      - id: length
        type: u2
      - id: value
        size: length
enums:
  tag_type:
    1: hostname
    2: ip_address
    3: port
    4: message
