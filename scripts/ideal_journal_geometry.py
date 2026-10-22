def numeric_anchor_side(row,column):
    """Unknown anchors need explicit layout evidence; never infer from column alone."""
    def value(c):return row[c]if 0<=c<len(row)else None
    if column<10 and (value(0)=='VOID' or isinstance(value(2),str)and value(2)):
        return 0
    if column>=10 and any(isinstance(value(c),str)and value(c)for c in (9,10,11,12)):
        return 1
    return None
