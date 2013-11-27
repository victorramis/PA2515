using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Runtime.Serialization;

namespace CanteenManagemenWebApp.Models
{
    [DataContract]
    public class CartItem
    {
        [DataMember(IsRequired = true)]
        public int Id { get; set; }
        [DataMember(IsRequired = true)]
        public string Name { get; set; }
    }
}